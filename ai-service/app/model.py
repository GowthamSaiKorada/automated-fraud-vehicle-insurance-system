"""
PyTorch CNN architecture and configurable model loader for
AI-Based Vehicle Insurance Fraud Detection.
"""

from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

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


def build_resnet18_classifier(num_classes: int = 2) -> nn.Module:
    model = tv_models.resnet18(weights=None)
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    return model


def build_vgg16_classifier(num_classes: int = 2) -> nn.Module:
    model = tv_models.vgg16(weights=None)
    model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, num_classes)
    return model


def build_mobilenetv2_classifier(num_classes: int = 2) -> nn.Module:
    model = tv_models.mobilenet_v2(weights=None)
    model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, num_classes)
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
        self.cnn_temperature: float = max(0.5, float(os.getenv("CNN_TEMPERATURE", "3.5")))

        self.yolo_model: Any = None
        self.yolo_model_path: Optional[str] = None
        self.yolo_loaded: bool = False
        self.yolo_load_error: Optional[str] = None

        self.comparison_models: Dict[str, Dict[str, Any]] = {}
        self.yolo_cls_model: Any = None

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

        self._load_comparison_models()

    def _load_comparison_models(self) -> None:
        """Load trained CNN, ResNet18, VGG16, MobileNetV2, and YOLOv8-cls comparison models if available."""
        models_dir = Path(__file__).resolve().parent.parent / "models"
        specs = [
            ("cnn", "CNN", Path(os.getenv("CNN_MODEL_PATH") or str(models_dir / "forensic_cnn.pth"))),
            ("resnet", "ResNet18", Path(os.getenv("RESNET_MODEL_PATH") or str(models_dir / "resnet18_damage.pth"))),
            ("vgg", "VGG16", Path(os.getenv("VGG_MODEL_PATH") or str(models_dir / "vgg16_damage.pth"))),
            (
                "mobilenetv2",
                "MobileNetV2",
                Path(os.getenv("MOBILENETV2_MODEL_PATH") or str(models_dir / "mobilenetv2_damage.pth")),
            ),
        ]

        builders = {
            "mobilenet_v3_small": lambda: build_mobilenet_classifier(2, pretrained=False),
            "resnet18": lambda: build_resnet18_classifier(2),
            "vgg16": lambda: build_vgg16_classifier(2),
            "mobilenet_v2": lambda: build_mobilenetv2_classifier(2),
            "custom": lambda: VehicleForensicCNN(2),
        }

        self.comparison_models = {}
        for key, label, path in specs:
            if not path.is_file():
                self.comparison_models[key] = {"model_name": label, "loaded": False}
                continue
            try:
                ckpt = torch.load(path, map_location=self.device, weights_only=True)
                backbone = ckpt.get("backbone", "custom") if isinstance(ckpt, dict) else "custom"
                builder = builders.get(backbone, builders["custom"])
                m = builder()
                sd = ckpt["model_state_dict"] if isinstance(ckpt, dict) and "model_state_dict" in ckpt else ckpt
                m.load_state_dict(sd)
                m.to(self.device)
                m.eval()
                self.comparison_models[key] = {
                    "model_name": label,
                    "loaded": True,
                    "model": m,
                    "backbone": backbone,
                    "val_acc": round(float(ckpt.get("val_acc", 0.0)) * 100.0, 2) if isinstance(ckpt, dict) else None,
                }
            except Exception as exc:  # noqa: BLE001
                logger.warning("Failed loading comparison model %s: %s", key, exc)
                self.comparison_models[key] = {"model_name": label, "loaded": False}

        yolo_cls_path = Path(os.getenv("YOLO_CLS_MODEL_PATH") or str(models_dir / "yolo_cls.pt"))
        if yolo_cls_path.is_file():
            try:
                config_dir = Path(__file__).resolve().parent.parent / ".ultralytics"
                config_dir.mkdir(parents=True, exist_ok=True)
                os.environ.setdefault("YOLO_CONFIG_DIR", str(config_dir))
                from ultralytics import YOLO  # type: ignore

                self.yolo_cls_model = YOLO(str(yolo_cls_path))
                self.comparison_models["yolo"] = {
                    "model_name": "YOLOv8n-cls",
                    "loaded": True,
                    "backbone": "yolov8n-cls",
                }
            except Exception as exc:  # noqa: BLE001
                logger.warning("Failed loading YOLO-cls comparison model: %s", exc)
                self.comparison_models["yolo"] = {"model_name": "YOLOv8n-cls", "loaded": False}
        else:
            self.comparison_models["yolo"] = {"model_name": "YOLOv8n-cls", "loaded": False}

    @torch.inference_mode()
    def predict_all_models(
        self,
        image: Image.Image,
        analysis_details: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Run inference across CNN, YOLOv8n-cls, ResNet18, VGG16, and MobileNetV2 with per-model explanations."""
        rgb = image.convert("RGB")
        tensor = self.preprocess(rgb).unsqueeze(0).to(self.device)
        results: List[Dict[str, Any]] = []

        # Collect actual triggered forensic flags from OpenCV/PIL analysis
        details = analysis_details or {}
        triggered_flags: List[str] = []
        meta = details.get("metadata") or {}
        if meta.get("editing_or_ai_software_detected"):
            markers = ", ".join(meta.get("matched_software_markers") or [])
            triggered_flags.append(f"Editing/AI software tag detected ({markers})")
        elif meta and not meta.get("exif_present"):
            triggered_flags.append("Camera EXIF metadata absent/stripped")
        if (details.get("noise_pattern") or {}).get("anomaly_flagged"):
            triggered_flags.append((details.get("noise_pattern") or {}).get("assessment", "Noise/ELA anomaly"))
        if (details.get("texture_consistency") or {}).get("anomaly_flagged"):
            triggered_flags.append((details.get("texture_consistency") or {}).get("assessment", "Texture inconsistency"))
        if (details.get("edge_artifacts") or {}).get("anomaly_flagged"):
            triggered_flags.append((details.get("edge_artifacts") or {}).get("assessment", "Edge density anomaly"))
        if (details.get("structural_irregularities") or {}).get("anomaly_flagged"):
            triggered_flags.append(
                (details.get("structural_irregularities") or {}).get("assessment", "8x8 block discontinuity")
            )

        arch_descriptions = {
            "cnn": "MobileNetV3-Small CNN (multi-scale vehicle damage vs. non-damage features)",
            "yolo": "YOLOv8n-cls Image Classifier (global object & damage state classification)",
            "resnet": "ResNet18 Residual Network (deep residual spatial & structural damage patterns)",
            "vgg": "VGG16 Convolutional Network (dense hierarchical texture & surface color filters)",
            "mobilenetv2": "MobileNetV2 Inverted-Residual CNN (depthwise separable edge & contour features)",
        }

        ordered_keys = ["cnn", "yolo", "resnet", "vgg", "mobilenetv2"]
        for key in ordered_keys:
            entry = self.comparison_models.get(key)
            if not entry or not entry.get("loaded"):
                results.append(
                    {
                        "model_key": key,
                        "model_name": entry.get("model_name", key.upper()) if entry else key.upper(),
                        "status": "model_unavailable",
                        "prediction": None,
                        "confidence": None,
                        "authentic_probability": None,
                        "suspicious_probability": None,
                        "val_accuracy": None,
                        "architecture": arch_descriptions.get(key, key.upper()),
                        "reason": "Model weights file is not loaded on the AI service.",
                        "forensic_flags": triggered_flags,
                    }
                )
                continue

            t0 = time.perf_counter()
            logit_gap: Optional[float] = None
            if key == "yolo" and self.yolo_cls_model is not None:
                yolo_res = self.yolo_cls_model.predict(rgb, verbose=False)[0]
                raw_probs = yolo_res.probs.data.cpu().float()
                names = yolo_res.names or {0: "00-damage", 1: "01-whole"}
                idx_auth = next((i for i, n in names.items() if "damage" in str(n).lower()), 0)
                idx_susp = (
                    1 - idx_auth
                    if len(raw_probs) == 2
                    else next((i for i, n in names.items() if i != idx_auth), 1)
                )
                pair = torch.tensor([raw_probs[idx_auth], raw_probs[idx_susp]]).clamp(min=1e-6)
                cal = torch.softmax(torch.log(pair) / 2.2, dim=0).tolist()
                auth_p = round(float(cal[0]) * 100.0, 2)
                susp_p = round(float(cal[1]) * 100.0, 2)
            else:
                logits = entry["model"](tensor).squeeze(0)
                logit_gap = round(float((logits[0] - logits[1]).item()), 2)
                probs = torch.softmax(logits / self.cnn_temperature, dim=0).cpu().tolist()
                auth_p = round(float(probs[0]) * 100.0, 2)
                susp_p = round(float(probs[1]) * 100.0, 2)

            latency_ms = round((time.perf_counter() - t0) * 1000.0, 1)
            pred = "SUSPICIOUS" if susp_p >= auth_p else "AUTHENTIC"
            conf = susp_p if pred == "SUSPICIOUS" else auth_p
            strength = (
                "High Confidence"
                if conf >= 80.0
                else ("Moderate Confidence" if conf >= 60.0 else "Borderline / Low Margin")
            )

            if pred == "SUSPICIOUS":
                reason = (
                    f"{entry['model_name']} assigned {susp_p:.1f}% Suspicious vs. {auth_p:.1f}% Authentic "
                    f"because visual features matched the undamaged/non-claim reference class (01-whole) "
                    f"more strongly than damaged vehicle patterns (00-damage)."
                )
                if triggered_flags:
                    reason += f" Concurrent forensic signals flagged: {'; '.join(triggered_flags[:2])}."
            else:
                reason = (
                    f"{entry['model_name']} assigned {auth_p:.1f}% Authentic vs. {susp_p:.1f}% Suspicious "
                    f"because visual features aligned with damaged vehicle patterns (00-damage) "
                    f"rather than undamaged/non-claim imagery (01-whole)."
                )
                if susp_p >= 30.0:
                    reason += (
                        f" Note: {susp_p:.1f}% residual Suspicious probability reflects partial ambiguity "
                        f"({strength.lower()}) in surface/angle cues"
                        + (f" and forensic flags ({triggered_flags[0]})." if triggered_flags else ".")
                    )

            results.append(
                {
                    "model_key": key,
                    "model_name": entry["model_name"],
                    "status": "model_loaded",
                    "prediction": pred,
                    "confidence": conf,
                    "authentic_probability": auth_p,
                    "suspicious_probability": susp_p,
                    "val_accuracy": entry.get("val_acc"),
                    "architecture": arch_descriptions.get(key, entry.get("backbone", key)),
                    "decision_strength": strength,
                    "inference_time_ms": latency_ms,
                    "logit_margin": logit_gap,
                    "reason": reason,
                    "forensic_flags": triggered_flags,
                }
            )

        return results

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
        probs = torch.softmax(logits / self.cnn_temperature, dim=1).squeeze(0).cpu().tolist()

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
