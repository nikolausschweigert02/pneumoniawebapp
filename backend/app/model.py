from __future__ import annotations

import io
import threading
import uuid
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn as nn
from PIL import Image, ImageFilter, ImageOps
from torchvision import transforms

from .clinical_copy import (
    CLINICIAN_NORMAL_TEXT,
    CLINICIAN_PNEUMONIA_TEXT,
    CONFIDENCE_DISCLAIMER,
    GRADCAM_NOTE,
)
from .gradcam import (
    GradCAMGenerator,
    confidence_from_threshold,
    overlay_gradcam,
    peak_region_from_cam,
)
from .model_architecture import (
    IMAGENET_MEAN,
    IMAGENET_STD,
    NORMAL_CLASS_INDEX,
    PNEUMONIA_CLASS_INDEX,
    SCREENING_THRESHOLD,
    build_resnet18_classifier,
)
from .model_config import (
    ModelConfig,
    load_model_config,
    load_model_summary,
    resolve_checkpoint_path,
)


class PneumoniaPredictor:
    """ResNet18 pneumonia inference with methodologically standard Grad-CAM."""

    def __init__(self, heatmap_dir: Path):
        self.heatmap_dir = heatmap_dir
        self.heatmap_dir.mkdir(parents=True, exist_ok=True)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.config = load_model_config()
        self.model_summary = load_model_summary()
        self.checkpoint_path = resolve_checkpoint_path()
        self.model = self._build_model(self.config).to(self.device).eval()
        self.using_checkpoint = self._load_checkpoint(self.checkpoint_path, self.config)
        self.gradcam = GradCAMGenerator(self.model, self.model.layer4[-1])
        self.lock = threading.Lock()
        self.preprocess = transforms.Compose(
            [
                transforms.Resize((self.config.image_size, self.config.image_size)),
                transforms.Grayscale(num_output_channels=3),
                transforms.ToTensor(),
                transforms.Normalize(mean=list(self.config.mean), std=list(self.config.std)),
            ]
        )
        self.demo_preprocess = transforms.Compose(
            [
                transforms.Resize((self.config.image_size, self.config.image_size)),
                transforms.ToTensor(),
                transforms.Normalize(mean=list(IMAGENET_MEAN), std=list(IMAGENET_STD)),
            ]
        )

    def predict(self, image_bytes: bytes) -> dict[str, Any]:
        image = self._load_image(image_bytes)

        with self.lock:
            if self.using_checkpoint:
                return self._predict_with_checkpoint(image)
            return self._predict_demo(image)

    def _predict_with_checkpoint(self, image: Image.Image) -> dict[str, Any]:
        tensor = self.preprocess(image).unsqueeze(0).to(self.device)
        self.gradcam.reset()
        self.model.zero_grad(set_to_none=True)

        with torch.enable_grad():
            logits = self.model(tensor)

        probabilities = torch.softmax(logits.detach(), dim=1)[0]
        p_normal = float(probabilities[NORMAL_CLASS_INDEX].item())
        p_pneumonia = float(probabilities[PNEUMONIA_CLASS_INDEX].item())

        if p_pneumonia >= SCREENING_THRESHOLD:
            prediction = "PNEUMONIA"
            screening_label = "PNEUMONIA-like pattern flagged"
            gradcam_class = PNEUMONIA_CLASS_INDEX
            recommendation = CLINICIAN_PNEUMONIA_TEXT
        else:
            prediction = "NORMAL"
            screening_label = "NORMAL-like pattern"
            gradcam_class = NORMAL_CLASS_INDEX
            recommendation = CLINICIAN_NORMAL_TEXT

        cam = self.gradcam.generate(logits, gradcam_class, image.size)
        region_name, region_score = peak_region_from_cam(cam)
        heatmap_url = self._save_heatmap(image, cam, use_raw_overlay=True)
        confidence = confidence_from_threshold(p_pneumonia, SCREENING_THRESHOLD)

        return {
            "prediction": prediction,
            "screening_label": screening_label,
            "probability": round(p_pneumonia, 4),
            "model_score_normal": round(p_normal, 4),
            "model_score_pneumonia": round(p_pneumonia, 4),
            "screening_threshold": SCREENING_THRESHOLD,
            "confidence": confidence,
            "confidence_disclaimer": CONFIDENCE_DISCLAIMER,
            "explanation": GRADCAM_NOTE,
            "gradcam_note": GRADCAM_NOTE,
            "recommendation": recommendation,
            "heatmap_url": heatmap_url,
            "suspicious_region": region_name,
            "region_opacity_score": round(region_score, 4),
            "opacity_pattern": self._opacity_pattern(prediction, region_score),
            "key_findings": self._key_findings(
                prediction=prediction,
                screening_label=screening_label,
                p_normal=p_normal,
                p_pneumonia=p_pneumonia,
                confidence=confidence,
                region_name=region_name,
                gradcam_class=gradcam_class,
            ),
            "model_mode": "trained_checkpoint",
            "model_name": self.config.model_name,
        }

    def _predict_demo(self, image: Image.Image) -> dict[str, Any]:
        tensor = self.demo_preprocess(image.convert("RGB")).unsqueeze(0).to(self.device)

        with torch.no_grad():
            logits = self.model(tensor)

        probability = self._opacity_probability(image)
        p_pneumonia = probability
        p_normal = max(0.0, 1.0 - p_pneumonia)
        prediction = "PNEUMONIA" if p_pneumonia >= SCREENING_THRESHOLD else "NORMAL"
        screening_label = (
            "PNEUMONIA-like pattern flagged" if prediction == "PNEUMONIA" else "NORMAL-like pattern"
        )
        region_name, region_score, region_scores = self._region_analysis(image)
        cam = self._opacity_heatmap(image, region_name)
        heatmap_url = self._save_heatmap(image, cam, use_raw_overlay=False)
        confidence = confidence_from_threshold(p_pneumonia, SCREENING_THRESHOLD)
        opacity_pattern = self._opacity_pattern(prediction, region_score, region_scores)

        return {
            "prediction": prediction,
            "screening_label": screening_label,
            "probability": round(p_pneumonia, 4),
            "model_score_normal": round(p_normal, 4),
            "model_score_pneumonia": round(p_pneumonia, 4),
            "screening_threshold": SCREENING_THRESHOLD,
            "confidence": confidence,
            "confidence_disclaimer": CONFIDENCE_DISCLAIMER,
            "explanation": (
                "Demo mode uses a deterministic opacity heuristic rather than the trained checkpoint. "
                f"{GRADCAM_NOTE}"
            ),
            "gradcam_note": GRADCAM_NOTE,
            "recommendation": self._recommendation(prediction, p_pneumonia),
            "heatmap_url": heatmap_url,
            "suspicious_region": region_name,
            "region_opacity_score": round(region_score, 4),
            "opacity_pattern": opacity_pattern,
            "key_findings": self._key_findings(
                prediction=prediction,
                screening_label=screening_label,
                p_normal=p_normal,
                p_pneumonia=p_pneumonia,
                confidence=confidence,
                region_name=region_name,
                gradcam_class=None,
                demo=True,
            ),
            "model_mode": "demo_heuristic",
            "model_name": "demo_resnet18",
        }

    def _build_model(self, config: ModelConfig) -> nn.Module:
        return build_resnet18_classifier(config.num_classes)

    def _load_checkpoint(self, checkpoint_path: Path | None, config: ModelConfig) -> bool:
        if checkpoint_path is None or not checkpoint_path.exists():
            return False

        checkpoint = torch.load(checkpoint_path, map_location=self.device, weights_only=False)
        state_dict = self._extract_state_dict(checkpoint, config.checkpoint_key)
        normalized_state_dict = self._normalize_state_dict(state_dict)

        if not normalized_state_dict:
            return False

        self.model.load_state_dict(normalized_state_dict, strict=False)
        return True

    def _extract_state_dict(self, checkpoint: Any, checkpoint_key: str | None) -> dict[str, torch.Tensor]:
        if isinstance(checkpoint, dict):
            if checkpoint_key and checkpoint_key in checkpoint and isinstance(checkpoint[checkpoint_key], dict):
                return checkpoint[checkpoint_key]

            for key in ("model_state_dict", "state_dict", "model", "net"):
                candidate = checkpoint.get(key)
                if isinstance(candidate, dict):
                    return candidate

            tensor_items = {
                key: value for key, value in checkpoint.items() if isinstance(value, torch.Tensor)
            }
            if tensor_items:
                return tensor_items

        if isinstance(checkpoint, dict):
            return checkpoint

        raise ValueError("Unsupported checkpoint format.")

    def _normalize_state_dict(self, state_dict: dict[str, torch.Tensor]) -> dict[str, torch.Tensor]:
        current_state = self.model.state_dict()
        normalized_state_dict: dict[str, torch.Tensor] = {}

        for key, value in state_dict.items():
            candidates = [
                key,
                key.replace("module.", "", 1),
                key.replace("model.", "", 1),
                key.replace("backbone.", "", 1),
            ]

            if key.startswith("classifier."):
                candidates.append(key.replace("classifier.", "fc.", 1))

            for candidate in candidates:
                if candidate in current_state and current_state[candidate].shape == value.shape:
                    normalized_state_dict[candidate] = value
                    break

        return normalized_state_dict

    def _load_image(self, image_bytes: bytes) -> Image.Image:
        image = Image.open(io.BytesIO(image_bytes))
        return ImageOps.exif_transpose(image).convert("RGB")

    def _opacity_probability(self, image: Image.Image) -> float:
        _, best_score, _ = self._region_analysis(image)
        gray = np.asarray(ImageOps.grayscale(image.resize((224, 224))), dtype=np.float32) / 255.0
        contrast = max(0.0, best_score)
        texture = float(gray.std())
        probability = 0.38 + (contrast * 2.4) + (texture * 0.28)
        return float(np.clip(probability, 0.05, 0.98))

    def _region_analysis(self, image: Image.Image) -> tuple[str, float, dict[str, float]]:
        gray = np.asarray(ImageOps.grayscale(image.resize((224, 224))), dtype=np.float32) / 255.0
        height, width = gray.shape
        global_mean = float(gray.mean())
        regions = {
            "upper left lung field": gray[int(height * 0.24):int(height * 0.52), int(width * 0.14):int(width * 0.46)],
            "upper right lung field": gray[int(height * 0.24):int(height * 0.52), int(width * 0.54):int(width * 0.86)],
            "lower left lung field": gray[int(height * 0.54):int(height * 0.88), int(width * 0.14):int(width * 0.46)],
            "lower right lung field": gray[int(height * 0.54):int(height * 0.88), int(width * 0.54):int(width * 0.86)],
        }
        scores = {name: float(region.mean()) - global_mean for name, region in regions.items()}
        region_name, region_score = max(scores.items(), key=lambda item: item[1])
        return region_name, region_score, scores

    def _regional_heatmap(self, image_size: tuple[int, int], region_name: str) -> np.ndarray:
        width, height = image_size
        centers = {
            "upper left lung field": (0.30, 0.38),
            "upper right lung field": (0.70, 0.38),
            "lower left lung field": (0.30, 0.70),
            "lower right lung field": (0.70, 0.70),
        }
        center_x, center_y = centers.get(region_name, (0.50, 0.60))
        y_grid, x_grid = np.mgrid[0:height, 0:width]
        sigma_x = width * 0.18
        sigma_y = height * 0.18
        heatmap = np.exp(
            -(((x_grid - center_x * width) ** 2) / (2 * sigma_x ** 2)
              + ((y_grid - center_y * height) ** 2) / (2 * sigma_y ** 2))
        )
        return heatmap / max(float(heatmap.max()), 1e-8)

    def _opacity_heatmap(self, image: Image.Image, region_name: str) -> np.ndarray:
        width, height = image.size
        gray_image = ImageOps.grayscale(image).resize((width, height))
        gray = np.asarray(gray_image, dtype=np.float32) / 255.0

        local_background = np.asarray(
            gray_image.filter(ImageFilter.GaussianBlur(radius=max(width, height) * 0.035)),
            dtype=np.float32,
        ) / 255.0
        opacity_signal = np.clip(gray - local_background, 0.0, None)
        opacity_signal = self._normalize_heatmap(opacity_signal)

        regional_prior = self._regional_heatmap(image.size, region_name)
        heatmap = (opacity_signal * 0.72) + (regional_prior * 0.28)
        return self._normalize_heatmap(heatmap)

    def _normalize_heatmap(self, heatmap: np.ndarray) -> np.ndarray:
        if heatmap.size == 0:
            return heatmap

        low, high = np.percentile(heatmap, [2, 98])
        if high - low < 1e-8:
            high = float(heatmap.max())
            low = float(heatmap.min())

        if high - low < 1e-8:
            return np.zeros_like(heatmap, dtype=np.float32)

        return np.clip((heatmap - low) / (high - low), 0.0, 1.0).astype(np.float32)

    def _save_heatmap(self, image: Image.Image, cam: np.ndarray, use_raw_overlay: bool) -> str:
        if use_raw_overlay:
            heatmap_image = overlay_gradcam(image, cam)
        else:
            heatmap_image = overlay_gradcam(image, self._normalize_heatmap(cam))

        filename = f"{uuid.uuid4().hex}.png"
        heatmap_image.save(self.heatmap_dir / filename)
        return f"/static/heatmaps/{filename}"

    def _opacity_pattern(
        self,
        prediction: str,
        region_score: float,
        region_scores: dict[str, float] | None = None,
    ) -> str:
        if prediction == "NORMAL":
            return "low_suspicion"

        if region_scores is None:
            if region_score > 0.08:
                return "focal"
            if region_score > 0.03:
                return "multifocal_or_diffuse"
            return "subtle"

        sorted_scores = sorted(region_scores.values(), reverse=True)
        second_best = sorted_scores[1] if len(sorted_scores) > 1 else 0.0
        if region_score > 0.08 and region_score - second_best > 0.035:
            return "focal"
        if region_score > 0.03:
            return "multifocal_or_diffuse"
        return "subtle"

    def _key_findings(
        self,
        prediction: str,
        screening_label: str,
        p_normal: float,
        p_pneumonia: float,
        confidence: str,
        region_name: str,
        gradcam_class: int | None,
        demo: bool = False,
    ) -> list[str]:
        findings = [
            f"Screening result: {screening_label}.",
            f"Model score (NORMAL): {p_normal:.4f}; model score (PNEUMONIA): {p_pneumonia:.4f}.",
            f"Screening threshold: {SCREENING_THRESHOLD:.2f}.",
            f"Confidence (uncertainty-based): {confidence}. {CONFIDENCE_DISCLAIMER}",
            f"Strongest Grad-CAM influence region: {region_name}.",
        ]

        if demo:
            findings.insert(0, "Demo mode: heatmap is heuristic and not generated from the trained checkpoint.")
        else:
            findings.insert(
                0,
                f"Prediction generated by trained model `{self.config.model_name}` with class {gradcam_class} Grad-CAM.",
            )
            if self.model_summary:
                findings.append(self.model_summary.splitlines()[0])

        if prediction == "PNEUMONIA":
            findings.append(
                "Screening threshold exceeded for the PNEUMONIA class score; manual radiological review is required."
            )
        else:
            findings.append(
                "PNEUMONIA class score remained below the screening threshold; manual review is still required."
            )

        return findings

    def _recommendation(self, prediction: str, probability: float) -> str:
        if prediction == "PNEUMONIA":
            return CLINICIAN_PNEUMONIA_TEXT
        return CLINICIAN_NORMAL_TEXT
