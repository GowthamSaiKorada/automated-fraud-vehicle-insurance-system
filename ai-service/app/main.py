"""
FastAPI AI Service for Vehicle Insurance Image Authenticity Verification
and Optional YOLO Vehicle Damage Localization.
"""

from __future__ import annotations

import io
import logging
import os
from typing import Any, Dict

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

from app.forensics import analyze_image_forensics
from app.model import ModelManager

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("ai_service")

ALLOWED_MIME_TYPES = {"image/jpeg", "image/jpg", "image/png"}
MAX_IMAGE_BYTES = int(os.getenv("MAX_FILE_SIZE_MB", "10")) * 1024 * 1024

app = FastAPI(
    title="Vehicle Insurance Fraud AI Verification Service",
    description=(
        "CNN-based image authenticity classification service with deterministic "
        "forensic analysis and explicit Demo Mode when no trained CNN checkpoint is loaded."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model_manager = ModelManager()


async def _read_and_validate_image(file: UploadFile) -> tuple[Image.Image, int, str]:
    if file.content_type and file.content_type.lower() not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{file.content_type}'. Only JPG, JPEG, and PNG are allowed.",
        )

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"Image exceeds maximum allowed size of {MAX_IMAGE_BYTES // (1024 * 1024)} MB.",
        )

    try:
        image = Image.open(io.BytesIO(contents))
        image.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid or corrupted image file: {exc}") from exc

    return image, len(contents), file.filename or "uploaded_image.jpg"


@app.get("/health")
def health_check() -> Dict[str, Any]:
    """Return AI service health, device info, and CNN / YOLO model availability."""
    return {
        "status": "healthy",
        "service": "vehicle-insurance-ai-service",
        "device": str(model_manager.device),
        "cnn_model": {
            "loaded": model_manager.cnn_loaded,
            "model_status": "model_loaded" if model_manager.cnn_loaded else "demo_mode",
            "model_path": model_manager.cnn_model_path,
            "class_mapping": model_manager.cnn_class_mapping,
            "val_acc": model_manager.cnn_val_acc,
            "reason": model_manager.cnn_load_error,
        },
        "yolo_damage_detector": {
            "loaded": model_manager.yolo_loaded,
            "model_status": "model_loaded" if model_manager.yolo_loaded else "model_unavailable",
            "model_path": model_manager.yolo_model_path,
            "reason": model_manager.yolo_load_error,
        },
        "comparison_models": {
            k: {"model_name": v.get("model_name"), "loaded": bool(v.get("loaded"))}
            for k, v in model_manager.comparison_models.items()
        },
    }


@app.post("/predict")
async def predict_image_authenticity(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Analyze a vehicle accident image and classify it as AUTHENTIC or SUSPICIOUS.
    Runs trained PyTorch CNN inference if CNN_MODEL_PATH is loaded; otherwise runs
    explicit Demo Mode using deterministic OpenCV/PIL forensic metrics.
    """
    image, file_size, filename = await _read_and_validate_image(file)
    forensics = analyze_image_forensics(image, file_size, filename)
    model_comparisons = model_manager.predict_all_models(image, forensics["analysis_details"])

    if model_manager.cnn_loaded:
        prediction, confidence, auth_prob, susp_prob = model_manager.predict_cnn(image)
        arch_label = "VehicleForensicCNN (PyTorch)"
        if model_manager.cnn_class_mapping:
            classes = ", ".join(sorted(model_manager.cnn_class_mapping.keys()))
            arch_label = f"VehicleForensicCNN (PyTorch · {classes})"
        return {
            "prediction": prediction,
            "confidence": confidence,
            "authentic_probability": auth_prob,
            "suspicious_probability": susp_prob,
            "model_status": "model_loaded",
            "is_demo_prediction": False,
            "model_architecture": arch_label,
            "model_comparisons": model_comparisons,
            "disclaimer": (
                "AI classification is an investigative decision-support signal and does not "
                "automatically establish insurance fraud. Final decisions remain with authorized investigators."
            ),
            "analysis_details": forensics["analysis_details"],
        }

    # Explicit Demo Mode when no trained CNN checkpoint is connected
    return {
        "prediction": forensics["demo_prediction"],
        "confidence": forensics["demo_confidence"],
        "authentic_probability": forensics["demo_authentic_probability"],
        "suspicious_probability": forensics["demo_suspicious_probability"],
        "model_status": "demo_mode",
        "is_demo_prediction": True,
        "model_architecture": "Deterministic Forensic Heuristic (Demo Mode - No CNN Weights Loaded)",
        "model_comparisons": model_comparisons,
        "disclaimer": (
            "DEMO MODE ACTIVE: No trained CNN weights file is currently connected "
            f"({model_manager.cnn_load_error}). Image quality, ELA, noise, edge, and EXIF metrics "
            "below are genuinely computed from the uploaded image, while the classification score "
            "is a deterministic demo heuristic and NOT a verified trained-model prediction."
        ),
        "analysis_details": forensics["analysis_details"],
    }


@app.post("/detect-damage")
async def detect_vehicle_damage(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Optional YOLO-based vehicle damage localization endpoint.
    Returns explicit model_unavailable status if YOLO_MODEL_PATH is not configured.
    """
    image, _, filename = await _read_and_validate_image(file)

    if not model_manager.yolo_loaded:
        return {
            "filename": filename,
            "model_status": "model_unavailable",
            "is_demo_prediction": True,
            "detections": [],
            "detection_count": 0,
            "message": (
                "YOLO damage localization model is not loaded "
                f"({model_manager.yolo_load_error}). Configure YOLO_MODEL_PATH with trained "
                "vehicle-damage YOLO weights (.pt) to enable bounding-box localization."
            ),
        }

    result = model_manager.detect_damage_yolo(image)
    return {
        "filename": filename,
        "model_status": "model_loaded",
        "is_demo_prediction": False,
        **result,
    }
