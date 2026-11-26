"""
PyTorch CNN architecture and configurable model loader for
AI-Based Vehicle Insurance Fraud Detection.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import torch
import torch.nn as nn
import torchvision.models as tv_models
import torchvision.transforms as T
from PIL import Image

logger = logging.getLogger("ai_service.model")

CLASS_NAMES = ("AUTHENTIC", "SUSPICIOUS")


class ConvBlock(nn.Module):
    """Residual-style convolutional block with batch normalization and activation."""

    def __init__(self, in_ch: int, out_ch: int, downsample: bool = True) -> None:
        super().__init__()
        stride = 2 if downsample else 1
        self.conv1 = nn.Conv2d(in_ch, out_ch, kernel_size=3, stride=stride, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(out_ch)
        self.conv2 = nn.Conv2d(out_ch, out_ch, kernel_size=3, stride=1, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(out_ch)
        self.act = nn.GELU()
        self.shortcut: nn.Module = (
            nn.Sequential(
                nn.Conv2d(in_ch, out_ch, kernel_size=1, stride=stride, bias=False),
                nn.BatchNorm2d(out_ch),
            )
            if (in_ch != out_ch or downsample)
            else nn.Identity()
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        identity = self.shortcut(x)
        out = self.act(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        return self.act(out + identity)


class VehicleForensicCNN(nn.Module):
    """
    CNN classifier for distinguishing authentic camera-captured vehicle damage
    photos from AI-generated or manipulated images.
    Input shape: (B, 3, 224, 224)
    Output logits: (B, 2) -> index 0: AUTHENTIC, index 1: SUSPICIOUS
    """

    def __init__(self, num_classes: int = 2, dropout: float = 0.3) -> None:
        super().__init__()
        self.stem = nn.Sequential(
            nn.Conv2d(3, 32, kernel_size=3, stride=1, padding=1, bias=False),
            nn.BatchNorm2d(32),
            nn.GELU(),
        )
        self.features = nn.Sequential(
            ConvBlock(32, 64, downsample=True),
            ConvBlock(64, 128, downsample=True),
            ConvBlock(128, 256, downsample=True),
            ConvBlock(256, 256, downsample=True),
        )
        self.pool = nn.AdaptiveAvgPool2d((1, 1))
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Dropout(p=dropout),
            nn.Linear(256, 128),
            nn.GELU(),
            nn.Dropout(p=dropout * 0.5),
            nn.Linear(128, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.stem(x)
        x = self.features(x)
        x = self.pool(x)
        return self.classifier(x)


def build_mobilenet_classifier(num_classes: int = 2, pretrained: bool = False) -> nn.Module:
    """Lightweight MobileNetV3-Small CNN classifier for fast CPU/GPU inference and transfer learning."""
    weights = tv_models.MobileNet_V3_Small_Weights.DEFAULT if pretrained else None
    model = tv_models.mobilenet_v3_small(weights=weights)
    in_features = model.classifier[-1].in_features
    model.classifier[-1] = nn.Linear(in_features, num_classes)
    return model


def build_preprocess_transform(image_size: int = 224) -> T.Compose:
    """Standard preprocessing pipeline: resize, RGB tensor, ImageNet normalization."""
    return T.Compose(
        [
            T.Resize((image_size, image_size), interpolation=T.InterpolationMode.BICUBIC),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )


class ModelManager:
    """Loads and manages the optional trained CNN and YOLO models."""

    def __init__(self) -> None:
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.preprocess = build_preprocess_transform(224)

        self.cnn_model: Optional[nn.Module] = None
        self.cnn_model_path: Optional[str] = None
        self.cnn_loaded: bool = False
        self.cnn_load_error: Optional[str] = None
        self.cnn_class_mapping: Optional[Dict[str, int]] = None
        self.cnn_val_acc: Optional[float] = None
        self.cnn_backbone: str = "custom"

        self.yolo_model: Any = None
        self.yolo_model_path: Optional[str] = None
        self.yolo_loaded: bool = False
        self.yolo_load_error: Optional[str] = None

        self.load_models()

    def load_models(self) -> None:
        """Attempt to load configured CNN and optional YOLO weights from disk."""
        cnn_path_env = (os.getenv("CNN_MODEL_PATH") or "").strip()
        demo_override = (os.getenv("AI_DEMO_MODE") or "").strip().lower() == "true"

        if cnn_path_env and not demo_override:
            resolved = Path(cnn_path_env)
            if resolved.is_file():
                try:
                    checkpoint = torch.load(resolved, map_location=self.device, weights_only=True)
                    backbone = (
                        checkpoint.get("backbone", "custom")
                        if isinstance(checkpoint, dict)
                        else "custom"
                    )
                    model = (
                        build_mobilenet_classifier(num_classes=2, pretrained=False)
                        if backbone == "mobilenet_v3_small"
                        else VehicleForensicCNN(num_classes=2)
                    )
                    state_dict = (
                        checkpoint["model_state_dict"]
                        if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint
                        else checkpoint
                    )
                    if isinstance(checkpoint, dict):
                        self.cnn_class_mapping = checkpoint.get("class_to_idx")
                        self.cnn_val_acc = checkpoint.get("val_acc")
                    self.cnn_backbone = str(backbone)
                    model.load_state_dict(state_dict)
                    model.to(self.device)
                    model.eval()
                    self.cnn_model = model
                    self.cnn_model_path = str(resolved)
                    self.cnn_loaded = True
                    self.cnn_load_error = None
                    logger.info("Loaded trained CNN weights from %s", resolved)
                except Exception as exc:  # noqa: BLE001
                    self.cnn_model = None
                    self.cnn_loaded = False
                    self.cnn_load_error = f"Failed to load CNN checkpoint: {exc}"
                    logger.warning(self.cnn_load_error)
            else:
                self.cnn_loaded = False
                self.cnn_load_error = f"Configured CNN_MODEL_PATH does not exist: {resolved}"
                logger.info("%s — running in explicit Demo Mode.", self.cnn_load_error)
        else:
            self.cnn_loaded = False
            self.cnn_load_error = (
                "AI_DEMO_MODE=true" if demo_override else "CNN_MODEL_PATH not configured"
            )
            logger.info("CNN model not loaded (%s). Running in explicit Demo Mode.", self.cnn_load_error)

        yolo_path_env = (os.getenv("YOLO_MODEL_PATH") or "").strip()
        if yolo_path_env:
            yolo_resolved = Path(yolo_path_env)
            if yolo_resolved.is_file():
                try:
                    config_dir = Path(__file__).resolve().parent.parent / ".ultralytics"
                    config_dir.mkdir(parents=True, exist_ok=True)
                    os.environ.setdefault("YOLO_CONFIG_DIR", str(config_dir))

                    from ultralytics import YOLO  # type: ignore

                    self.yolo_model = YOLO(str(yolo_resolved))
                    self.yolo_model_path = str(yolo_resolved)
                    self.yolo_loaded = True
                    self.yolo_load_error = None
                    logger.info("Loaded YOLO damage detector from %s", yolo_resolved)
                except Exception as exc:  # noqa: BLE001
                    self.yolo_model = None
                    self.yolo_loaded = False
                    self.yolo_load_error = f"Failed to load YOLO weights: {exc}"
                    logger.warning(self.yolo_load_error)
            else:
                self.yolo_loaded = False
                self.yolo_load_error = f"Configured YOLO_MODEL_PATH does not exist: {yolo_resolved}"
        else:
            self.yolo_loaded = False
            self.yolo_load_error = "YOLO_MODEL_PATH not configured"

    @torch.inference_mode()
    def predict_cnn(self, image: Image.Image) -> Tuple[str, float, float, float]:
        """
        Run preprocessing, forward pass, and softmax interpretation on a loaded CNN.
        Returns (prediction_label, confidence_pct, authentic_pct, suspicious_pct).
        """
        if not self.cnn_loaded or self.cnn_model is None:
            raise RuntimeError("Trained CNN model is not loaded.")

        rgb_image = image.convert("RGB")
        tensor = self.preprocess(rgb_image).unsqueeze(0).to(self.device)
        logits = self.cnn_model(tensor)
        probs = torch.softmax(logits, dim=1).squeeze(0).cpu().tolist()

        auth_prob = round(float(probs[0]) * 100.0, 2)
        susp_prob = round(float(probs[1]) * 100.0, 2)
        if susp_prob >= auth_prob:
            return "SUSPICIOUS", susp_prob, auth_prob, susp_prob
        return "AUTHENTIC", auth_prob, auth_prob, susp_prob

    def detect_damage_yolo(self, image: Image.Image) -> Dict[str, Any]:
        """Run YOLO inference for vehicle damage localization when weights are loaded."""
        if not self.yolo_loaded or self.yolo_model is None:
            raise RuntimeError("YOLO model is not loaded.")

        results = self.yolo_model.predict(image.convert("RGB"), verbose=False)
        detections = []
        for res in results:
            names = res.names or {}
            boxes = res.boxes
            if boxes is None:
                continue
            for box in boxes:
                xyxy = [round(float(v), 2) for v in box.xyxy[0].tolist()]
                cls_idx = int(box.cls[0].item())
                conf = round(float(box.conf[0].item()) * 100.0, 2)
                detections.append(
                    {
                        "label": names.get(cls_idx, f"class_{cls_idx}"),
                        "confidence": conf,
                        "bbox": {
                            "x1": xyxy[0],
                            "y1": xyxy[1],
                            "x2": xyxy[2],
                            "y2": xyxy[3],
                        },
                    }
                )
        return {
            "detections": detections,
            "detection_count": len(detections),
        }
