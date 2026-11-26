"""
Deterministic image forensic inspection module using OpenCV, Pillow, and NumPy.

Computes real, reproducible image quality, Error Level Analysis (ELA),
noise residual statistics, patch-wise texture consistency, edge artifacts,
structural block-boundary metrics, and EXIF metadata inspection.
"""

from __future__ import annotations

import base64
import io
from typing import Any, Dict, List, Tuple

import cv2
import numpy as np
from PIL import ExifTags, Image

AI_OR_EDIT_SOFTWARE_KEYWORDS = (
    "midjourney",
    "stable diffusion",
    "dall-e",
    "dalle",
    "comfyui",
    "automatic1111",
    "invokeai",
    "firefly",
    "photoshop",
    "adobe",
    "gimp",
    "lightroom",
    "canva",
    "snapseed",
    "generative",
    "imagen",
    "c2pa",
)


def _extract_exif(image: Image.Image) -> Dict[str, Any]:
    """Extract readable EXIF and container info fields without fabricating missing entries."""
    exif_raw = image.getexif()
    parsed: Dict[str, str] = {}
    if exif_raw:
        for tag_id, value in exif_raw.items():
            tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
            if tag_name in {
                "Make",
                "Model",
                "Software",
                "DateTime",
                "DateTimeOriginal",
                "Orientation",
                "ExifImageWidth",
                "ExifImageHeight",
            }:
                text_val = str(value).strip()
                if text_val:
                    parsed[tag_name] = text_val[:120]

    # Also scan XMP / PNG text chunks / comment metadata for editing or AI markers
    extra_meta_parts: List[str] = []
    for k, v in (image.info or {}).items():
        if k in {"icc_profile", "exif"}:
            continue
        if isinstance(v, (str, bytes)):
            txt = v.decode("utf-8", errors="ignore") if isinstance(v, bytes) else v
            extra_meta_parts.append(f"{k}:{txt[:500]}")

    combined_meta_text = f"{parsed.get('Software', '')} {' '.join(extra_meta_parts)}".lower()
    matched_software = [kw for kw in AI_OR_EDIT_SOFTWARE_KEYWORDS if kw in combined_meta_text]
    has_camera_info = bool(parsed.get("Make") or parsed.get("Model"))

    return {
        "exif_present": len(parsed) > 0,
        "tag_count": len(exif_raw) if exif_raw else 0,
        "has_camera_signature": has_camera_info,
        "camera_make": parsed.get("Make"),
        "camera_model": parsed.get("Model"),
        "software": parsed.get("Software") or (", ".join(matched_software) if matched_software else None),
        "captured_at": parsed.get("DateTimeOriginal") or parsed.get("DateTime"),
        "editing_or_ai_software_detected": len(matched_software) > 0,
        "matched_software_markers": matched_software,
        "fields": parsed,
    }


def _compute_ela_and_heatmap(image: Image.Image) -> Tuple[float, float, float, str]:
    """
    Compute Error Level Analysis (ELA) by re-compressing as JPEG quality=90
    and measuring pixel-level compression residuals, returning a base64 PNG heatmap.
    """
    rgb = image.convert("RGB")
    buffer = io.BytesIO()
    rgb.save(buffer, format="JPEG", quality=90)
    buffer.seek(0)
    recompressed = Image.open(buffer).convert("RGB")

    orig_arr = np.asarray(rgb, dtype=np.float32)
    recomp_arr = np.asarray(recompressed, dtype=np.float32)
    diff = np.abs(orig_arr - recomp_arr)

    ela_mean = float(np.mean(diff))
    ela_std = float(np.std(diff))
    ela_max = float(np.max(diff))

    # Build a downscaled visual ELA heatmap (max width 480px) for inspection
    gray_diff = np.mean(diff, axis=2)
    scale = 255.0 / max(float(np.percentile(gray_diff, 99.5)), 1.0)
    norm_diff = np.clip(gray_diff * scale, 0, 255).astype(np.uint8)
    heatmap_bgr = cv2.applyColorMap(norm_diff, cv2.COLORMAP_INFERNO)

    h, w = heatmap_bgr.shape[:2]
    if w > 480:
        new_h = max(1, int(h * (480.0 / w)))
        heatmap_bgr = cv2.resize(heatmap_bgr, (480, new_h), interpolation=cv2.INTER_AREA)

    ok, png_buf = cv2.imencode(".png", heatmap_bgr)
    data_url = ""
    if ok:
        b64 = base64.b64encode(png_buf.tobytes()).decode("ascii")
        data_url = f"data:image/png;base64,{b64}"

    return round(ela_mean, 3), round(ela_std, 3), round(ela_max, 3), data_url


def analyze_image_forensics(image: Image.Image, file_size_bytes: int, filename: str) -> Dict[str, Any]:
    """
    Perform real deterministic computer-vision forensic analysis on an uploaded image.
    Returns structured analysis_details and a transparent heuristic score for Demo Mode.
    """
    rgb = image.convert("RGB")
    width, height = rgb.size
    arr_rgb = np.asarray(rgb, dtype=np.uint8)
    arr_bgr = cv2.cvtColor(arr_rgb, cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(arr_bgr, cv2.COLOR_BGR2GRAY)

    # 1. Image Quality Metrics
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    mean_brightness = float(np.mean(gray))
    contrast_std = float(np.std(gray))
    megapixels = round((width * height) / 1_000_000.0, 2)

    quality_rating = "Good"
    if width < 400 or height < 400 or laplacian_var < 35.0:
        quality_rating = "Low Resolution / Blurry"
    elif laplacian_var > 120.0 and width >= 800:
        quality_rating = "High Detail"

    image_quality = {
        "filename": filename,
        "format": image.format or "UNKNOWN",
        "color_mode": image.mode,
        "width": width,
        "height": height,
        "megapixels": megapixels,
        "file_size_kb": round(file_size_bytes / 1024.0, 2),
        "sharpness_score": round(laplacian_var, 2),
        "brightness_mean": round(mean_brightness, 2),
        "contrast_std": round(contrast_std, 2),
        "assessment": quality_rating,
    }

    # 2. Noise Pattern & ELA Analysis
    ela_mean, ela_std, ela_max, ela_heatmap_url = _compute_ela_and_heatmap(rgb)
    denoised = cv2.medianBlur(arr_bgr, 3)
    residual = arr_bgr.astype(np.float32) - denoised.astype(np.float32)
    channel_noise_stds = [float(np.std(residual[:, :, c])) for c in range(3)]
    noise_mean_std = float(np.mean(channel_noise_stds))
    noise_channel_spread = float(np.max(channel_noise_stds) - np.min(channel_noise_stds))

    noise_assessment = "Consistent sensor-like noise residual"
    noise_flag = False
    if noise_mean_std < 1.1:
        noise_assessment = "Unusually low high-frequency sensor noise (possible synthetic smoothing)"
        noise_flag = True
    elif ela_std > 9.5:
        noise_assessment = "Elevated Error Level Analysis variance across image regions"
        noise_flag = True

    noise_pattern = {
        "ela_mean_error": ela_mean,
        "ela_std_error": ela_std,
        "ela_max_error": ela_max,
        "residual_noise_std": round(noise_mean_std, 3),
        "channel_noise_spread": round(noise_channel_spread, 3),
        "anomaly_flagged": noise_flag,
        "assessment": noise_assessment,
    }

    # 3. Texture Consistency Analysis (8x8 grid patch variance coefficient of variation)
    ph, pw = max(height // 8, 8), max(width // 8, 8)
    patch_lap_vars: List[float] = []
    lap_full = cv2.Laplacian(gray, cv2.CV_64F)
    for r in range(0, min(height - ph + 1, ph * 8), ph):
        for c in range(0, min(width - pw + 1, pw * 8), pw):
            patch = lap_full[r : r + ph, c : c + pw]
            patch_lap_vars.append(float(np.var(patch)))

    if patch_lap_vars and float(np.mean(patch_lap_vars)) > 0:
        texture_cv = float(np.std(patch_lap_vars) / (np.mean(patch_lap_vars) + 1e-6))
    else:
        texture_cv = 0.0

    flat_patch_ratio = (
        float(np.mean([v < 12.0 for v in patch_lap_vars])) if patch_lap_vars else 0.0
    )

    texture_flag = (
        texture_cv > 2.0
        or flat_patch_ratio > 0.35
        or float(np.median(patch_lap_vars or [0.0])) < 18.0
    )
    if flat_patch_ratio > 0.35:
        texture_assessment = (
            f"Large uniform/flat background regions ({round(flat_patch_ratio * 100, 1)}% of patches; "
            "common in cutouts, documents, or synthetic renders)"
        )
    elif texture_flag:
        texture_assessment = "Irregular patch-to-patch texture variance or overly smooth local regions"
    else:
        texture_assessment = "Natural spatial texture variation across frame regions"

    texture_consistency = {
        "patch_count_analyzed": len(patch_lap_vars),
        "patch_variance_cv": round(texture_cv, 3),
        "flat_patch_ratio": round(flat_patch_ratio, 3),
        "median_patch_energy": round(float(np.median(patch_lap_vars or [0.0])), 2),
        "anomaly_flagged": texture_flag,
        "assessment": texture_assessment,
    }

    # 4. Edge Artifact Analysis
    edges = cv2.Canny(gray, 80, 180)
    edge_density = float(np.mean(edges > 0))
    sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    grad_mag = np.sqrt(sobelx**2 + sobely**2)
    high_grad_ratio = float(np.mean(grad_mag > 140.0))

    edge_flag = edge_density > 0.16 or (edge_density < 0.015 and laplacian_var < 30.0)
    edge_assessment = (
        "Atypical edge density or sharp transition concentration detected (e.g., text/graphics or ringing)"
        if edge_flag
        else "Edge gradients fall within expected photographic distribution"
    )

    edge_artifacts = {
        "canny_edge_density": round(edge_density, 4),
        "high_gradient_pixel_ratio": round(high_grad_ratio, 4),
        "anomaly_flagged": edge_flag,
        "assessment": edge_assessment,
    }

    # 5. Structural Irregularity (8x8 JPEG block boundary vs interior gradient ratio)
    gray_f = gray.astype(np.float32)
    if height >= 24 and width >= 24:
        v_diff = np.abs(np.diff(gray_f, axis=1))
        h_diff = np.abs(np.diff(gray_f, axis=0))
        v_block = v_diff[:, 7::8]
        v_inner = np.delete(v_diff, slice(7, None, 8), axis=1)
        h_block = h_diff[7::8, :]
        h_inner = np.delete(h_diff, slice(7, None, 8), axis=0)
        block_energy = (float(np.mean(v_block)) + float(np.mean(h_block))) / 2.0
        inner_energy = max((float(np.mean(v_inner)) + float(np.mean(h_inner))) / 2.0, 1e-4)
        blocking_ratio = block_energy / inner_energy
    else:
        blocking_ratio = 1.0

    structural_flag = blocking_ratio > 1.22 or blocking_ratio < 0.82
    structural_assessment = (
        "Discontinuous 8x8 block boundary alignment (possible re-saving or splicing)"
        if structural_flag
        else "No major block-grid alignment discontinuity detected"
    )

    structural_irregularities = {
        "block_boundary_ratio": round(blocking_ratio, 3),
        "anomaly_flagged": structural_flag,
        "assessment": structural_assessment,
    }

    # 6. Metadata & Continuous Multi-Signal Heuristic Risk Scoring (Demo Mode)
    metadata = _extract_exif(image)
    findings: List[str] = []

    # Continuous contributions derived directly from measured image properties
    ela_component = float(np.clip((ela_std - 1.5) * 2.1, 0.0, 18.0))
    noise_low_component = float(np.clip((2.4 - noise_mean_std) * 6.5, 0.0, 15.0))
    noise_spread_component = float(np.clip(noise_channel_spread * 3.5, 0.0, 8.0))
    texture_cv_component = float(np.clip((texture_cv - 0.85) * 7.5, 0.0, 15.0))
    flat_bg_component = float(np.clip(flat_patch_ratio * 24.0, 0.0, 18.0))
    edge_component = float(np.clip((edge_density - 0.07) * 90.0, 0.0, 15.0))
    block_dev_component = float(np.clip(abs(blocking_ratio - 1.0) * 38.0, 0.0, 14.0))

    suspicion_score = (
        10.0
        + ela_component
        + noise_low_component
        + noise_spread_component
        + texture_cv_component
        + flat_bg_component
        + edge_component
        + block_dev_component
    )

    if metadata["editing_or_ai_software_detected"]:
        suspicion_score += 26.0
        findings.append(
            f"Metadata references editing/AI software ({', '.join(metadata['matched_software_markers'])})."
        )
    elif not metadata["exif_present"]:
        suspicion_score += 11.0
        findings.append("Camera EXIF metadata is absent or stripped (common in web downloads, screenshots, or AI exports).")
    elif metadata["has_camera_signature"]:
        suspicion_score -= 10.0
        findings.append(
            f"Camera metadata present ({metadata.get('camera_make') or ''} {metadata.get('camera_model') or ''}).".strip()
        )

    if noise_flag:
        findings.append(noise_assessment)
    if texture_flag:
        findings.append(texture_assessment)
    if edge_flag:
        findings.append(edge_assessment)
    if structural_flag:
        findings.append(structural_assessment)

    if not findings:
        findings.append("No elevated forensic anomalies triggered under deterministic pixel-signal checks.")

    suspicion_score = float(np.clip(suspicion_score, 6.5, 95.5))
    authentic_score = round(100.0 - suspicion_score, 2)
    suspicion_score = round(suspicion_score, 2)

    ai_generation_suspicion = {
        "heuristic_risk_score": suspicion_score,
        "risk_level": "High" if suspicion_score >= 60 else ("Moderate" if suspicion_score >= 40 else "Low"),
        "signals_triggered": sum(
            [
                1 if metadata["editing_or_ai_software_detected"] else 0,
                1 if not metadata["exif_present"] else 0,
                1 if noise_flag else 0,
                1 if texture_flag else 0,
                1 if edge_flag else 0,
                1 if structural_flag else 0,
            ]
        ),
        "note": (
            "Heuristic signal summary computed directly from image pixel statistics and EXIF tags; "
            "connect a trained CNN checkpoint for learned classification."
        ),
    }

    analysis_details = {
        "image_quality": image_quality,
        "texture_consistency": texture_consistency,
        "noise_pattern": noise_pattern,
        "edge_artifacts": edge_artifacts,
        "structural_irregularities": structural_irregularities,
        "ai_generation_suspicion": ai_generation_suspicion,
        "metadata": metadata,
        "visual_explanation": {
            "type": "Error Level Analysis (ELA) Heatmap",
            "description": (
                "Brighter regions indicate higher JPEG re-compression residual differences, "
                "which can highlight edited regions or uneven texture synthesis."
            ),
            "heatmap_data_url": ela_heatmap_url,
        },
        "summary_findings": findings,
    }

    demo_prediction = "SUSPICIOUS" if suspicion_score >= 50.0 else "AUTHENTIC"
    demo_confidence = suspicion_score if demo_prediction == "SUSPICIOUS" else authentic_score

    return {
        "analysis_details": analysis_details,
        "demo_prediction": demo_prediction,
        "demo_confidence": demo_confidence,
        "demo_authentic_probability": authentic_score,
        "demo_suspicious_probability": suspicion_score,
    }
