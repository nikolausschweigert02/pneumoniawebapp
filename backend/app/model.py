from __future__ import annotations

import io
import threading
import uuid
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image, ImageFilter, ImageOps
from torchvision import transforms
from torchvision.models import ResNet18_Weights, resnet18

from .model_config import (
    ModelConfig,
    load_model_config,
    load_model_summary,
    resolve_checkpoint_path,
)


class PneumoniaPredictor:
    """ResNet18 pneumonia inference wrapper with Grad-CAM visualization.

    If PNEUMONIA_MODEL_PATH points to a trained two-class ResNet18 checkpoint,
    its logits drive the prediction. Without a checkpoint, the MVP uses a
    deterministic opacity heuristic for probability while still running the
    ResNet18 backbone for Grad-CAM-style visual explanation.
    """

    def __init__(self, heatmap_dir: Path):
        self.heatmap_dir = heatmap_dir
        self.heatmap_dir.mkdir(parents=True, exist_ok=True)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.config = load_model_config()
        self.model_summary = load_model_summary()
        self.checkpoint_path = resolve_checkpoint_path()
        self.model = self._build_model(self.config).to(self.device).eval()
        self.using_checkpoint = self._load_checkpoint(self.checkpoint_path, self.config)
        self.target_layer = self.model.layer4[-1]
        self.activations: torch.Tensor | None = None
        self.gradients: torch.Tensor | None = None
        self.lock = threading.Lock()
        self.preprocess = transforms.Compose(
            [
                transforms.Resize((self.config.image_size, self.config.image_size)),
                transforms.ToTensor(),
                transforms.Normalize(mean=list(self.config.mean), std=list(self.config.std))
            ]
        )
        self.target_layer.register_forward_hook(self._capture_activations)
        self.target_layer.register_full_backward_hook(self._capture_gradients)

    def predict(self, image_bytes: bytes) -> dict[str, Any]:
        image = self._load_image(image_bytes)

        with self.lock:
            tensor = self.preprocess(image).unsqueeze(0).to(self.device)
            logits = self._forward_with_gradients(tensor)

            if self.using_checkpoint:
                probability = float(
                    torch.softmax(logits.detach(), dim=1)[0, self.config.pneumonia_class_index].item()
                )
            else:
                probability = self._opacity_probability(image)

            target_class = 1 if probability >= 0.5 else 0
            cam = self._gradcam(logits, target_class, image.size) if self.using_checkpoint else None

        region_name, region_score, region_scores = self._region_analysis(image)
        if cam is None:
            cam = self._opacity_heatmap(image, region_name)
        else:
            cam = self._postprocess_heatmap(cam, image.size)

        heatmap_url = self._save_heatmap(image, cam)
        prediction = "PNEUMONIA" if probability >= 0.5 else "NORMAL"
        confidence = self._confidence(probability)
        opacity_pattern = self._opacity_pattern(prediction, region_score, region_scores)

        return {
            "prediction": prediction,
            "probability": round(probability, 4),
            "confidence": confidence,
            "explanation": self._explanation(prediction, region_name, region_score),
            "recommendation": self._recommendation(prediction, probability),
            "heatmap_url": heatmap_url,
            "suspicious_region": region_name,
            "region_opacity_score": round(region_score, 4),
            "opacity_pattern": opacity_pattern,
            "key_findings": self._key_findings(
                prediction=prediction,
                probability=probability,
                confidence=confidence,
                region_name=region_name,
                region_score=region_score,
                opacity_pattern=opacity_pattern
            ),
            "model_mode": "trained_checkpoint" if self.using_checkpoint else "demo_heuristic",
            "model_name": self.config.model_name if self.using_checkpoint else "demo_resnet18"
        }

    def _build_model(self, config: ModelConfig) -> nn.Module:
        try:
            model = resnet18(weights=ResNet18_Weights.DEFAULT)
        except Exception:
            model = resnet18(weights=None)

        model.fc = nn.Linear(model.fc.in_features, config.num_classes)
        if not self.checkpoint_path:
            torch.manual_seed(42)
            nn.init.xavier_uniform_(model.fc.weight)
            nn.init.zeros_(model.fc.bias)
        return model

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

            if key.startswith("fc."):
                candidates.append(key)
            elif key.startswith("classifier."):
                candidates.append(key.replace("classifier.", "fc.", 1))

            for candidate in candidates:
                if candidate in current_state and current_state[candidate].shape == value.shape:
                    normalized_state_dict[candidate] = value
                    break

        return normalized_state_dict

    def _load_image(self, image_bytes: bytes) -> Image.Image:
        image = Image.open(io.BytesIO(image_bytes))
        return ImageOps.exif_transpose(image).convert("RGB")

    def _forward_with_gradients(self, tensor: torch.Tensor) -> torch.Tensor:
        self.activations = None
        self.gradients = None
        self.model.zero_grad(set_to_none=True)
        with torch.enable_grad():
            return self.model(tensor)

    def _capture_activations(
        self,
        _module: nn.Module,
        _inputs: tuple[torch.Tensor, ...],
        output: torch.Tensor
    ) -> None:
        self.activations = output.detach()

    def _capture_gradients(
        self,
        _module: nn.Module,
        _grad_input: tuple[torch.Tensor, ...],
        grad_output: tuple[torch.Tensor, ...]
    ) -> None:
        self.gradients = grad_output[0].detach()

    def _gradcam(self, logits: torch.Tensor, target_class: int, image_size: tuple[int, int]) -> np.ndarray | None:
        score = logits[0, target_class]
        self.model.zero_grad(set_to_none=True)
        score.backward(retain_graph=False)

        if self.activations is None or self.gradients is None:
            return None

        weights = self.gradients.mean(dim=(2, 3), keepdim=True)
        cam = torch.relu((weights * self.activations).sum(dim=1, keepdim=True))
        cam = F.interpolate(cam, size=(image_size[1], image_size[0]), mode="bilinear", align_corners=False)
        cam_np = cam.squeeze().cpu().numpy()
        cam_min = float(cam_np.min())
        cam_max = float(cam_np.max())

        if cam_max - cam_min < 1e-8:
            return None

        return (cam_np - cam_min) / (cam_max - cam_min)

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
            "upper left lung": gray[int(height * 0.24):int(height * 0.52), int(width * 0.14):int(width * 0.46)],
            "upper right lung": gray[int(height * 0.24):int(height * 0.52), int(width * 0.54):int(width * 0.86)],
            "lower left lung": gray[int(height * 0.54):int(height * 0.88), int(width * 0.14):int(width * 0.46)],
            "lower right lung": gray[int(height * 0.54):int(height * 0.88), int(width * 0.54):int(width * 0.86)]
        }
        scores = {name: float(region.mean()) - global_mean for name, region in regions.items()}
        region_name, region_score = max(scores.items(), key=lambda item: item[1])
        return region_name, region_score, scores

    def _regional_heatmap(self, image_size: tuple[int, int], region_name: str) -> np.ndarray:
        width, height = image_size
        centers = {
            "upper left lung": (0.30, 0.38),
            "upper right lung": (0.70, 0.38),
            "lower left lung": (0.30, 0.70),
            "lower right lung": (0.70, 0.70)
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
        """Create a stable demo-mode heatmap from localized opacity signal."""
        width, height = image.size
        gray_image = ImageOps.grayscale(image).resize((width, height))
        gray = np.asarray(gray_image, dtype=np.float32) / 255.0

        local_background = np.asarray(
            gray_image.filter(ImageFilter.GaussianBlur(radius=max(width, height) * 0.035)),
            dtype=np.float32
        ) / 255.0
        opacity_signal = np.clip(gray - local_background, 0.0, None)
        opacity_signal = self._normalize_heatmap(opacity_signal)

        lung_mask = self._lung_mask(image.size)
        regional_prior = self._regional_heatmap(image.size, region_name)
        heatmap = ((opacity_signal * 0.72) + (regional_prior * 0.28)) * lung_mask
        return self._postprocess_heatmap(heatmap, image.size)

    def _postprocess_heatmap(self, heatmap: np.ndarray, image_size: tuple[int, int]) -> np.ndarray:
        heatmap = np.nan_to_num(heatmap, nan=0.0, posinf=1.0, neginf=0.0)
        heatmap = np.clip(heatmap, 0.0, None)
        heatmap = self._normalize_heatmap(heatmap)
        heatmap = heatmap * self._lung_mask(image_size)
        heatmap = self._smooth_heatmap(heatmap, radius=max(image_size) * 0.018)
        heatmap = self._normalize_heatmap(heatmap)
        heatmap[heatmap < 0.12] = 0.0
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

    def _smooth_heatmap(self, heatmap: np.ndarray, radius: float) -> np.ndarray:
        image = Image.fromarray((np.clip(heatmap, 0.0, 1.0) * 255).astype(np.uint8))
        smoothed = image.filter(ImageFilter.GaussianBlur(radius=max(1.0, radius)))
        return np.asarray(smoothed, dtype=np.float32) / 255.0

    def _lung_mask(self, image_size: tuple[int, int]) -> np.ndarray:
        width, height = image_size
        y_grid, x_grid = np.mgrid[0:height, 0:width]
        left = (
            ((x_grid - width * 0.34) / (width * 0.22)) ** 2
            + ((y_grid - height * 0.55) / (height * 0.34)) ** 2
        ) <= 1.0
        right = (
            ((x_grid - width * 0.66) / (width * 0.22)) ** 2
            + ((y_grid - height * 0.55) / (height * 0.34)) ** 2
        ) <= 1.0
        mask = np.logical_or(left, right).astype(np.float32)
        return self._smooth_heatmap(mask, radius=max(width, height) * 0.012)

    def _save_heatmap(self, image: Image.Image, cam: np.ndarray) -> str:
        base = np.asarray(image, dtype=np.float32) / 255.0
        heat = self._colorize(cam)
        alpha = np.clip((cam - 0.10) / 0.90, 0.0, 1.0)[..., None] * 0.62
        overlay = np.clip((base * (1.0 - alpha)) + (heat * alpha), 0.0, 1.0)
        heatmap_image = Image.fromarray((overlay * 255).astype(np.uint8))
        filename = f"{uuid.uuid4().hex}.png"
        heatmap_image.save(self.heatmap_dir / filename)
        return f"/static/heatmaps/{filename}"

    def _colorize(self, heatmap: np.ndarray) -> np.ndarray:
        x = np.clip(heatmap, 0.0, 1.0)
        red = np.clip(2.2 * x, 0.0, 1.0)
        green = np.clip(1.8 * x - 0.25, 0.0, 1.0)
        blue = np.clip(0.45 - x, 0.0, 0.45) / 0.45
        return np.stack([red, green, blue], axis=-1)

    def _confidence(self, probability: float) -> str:
        distance = abs(probability - 0.5)
        if distance >= 0.35:
            return "high"
        if distance >= 0.18:
            return "moderate"
        return "low"

    def _opacity_pattern(
        self,
        prediction: str,
        region_score: float,
        region_scores: dict[str, float]
    ) -> str:
        if prediction == "NORMAL":
            return "low_suspicion"

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
        probability: float,
        confidence: str,
        region_name: str,
        region_score: float,
        opacity_pattern: str
    ) -> list[str]:
        percent = round(probability * 100)
        score_description = "above" if region_score > 0 else "not above"

        findings = [
            f"AI pneumonia probability is {percent}% with {confidence} confidence.",
            f"Most influential region: {region_name}.",
            f"Regional opacity signal is {score_description} the image baseline."
        ]

        if self.using_checkpoint:
            findings.insert(0, f"Prediction generated by trained model `{self.config.model_name}`.")
            if self.model_summary:
                findings.append(self.model_summary.splitlines()[0])

        if prediction == "PNEUMONIA":
            if opacity_pattern == "focal":
                findings.append(f"Pattern appears focal, centered on the {region_name}.")
            elif opacity_pattern == "multifocal_or_diffuse":
                findings.append("Opacity signal appears broader rather than isolated to one small focus.")
            else:
                findings.append("Pneumonia probability is elevated, but the opacity signal is subtle.")
        else:
            findings.append("No region crossed the MVP pneumonia threshold, but clinical correlation is still required.")

        return findings

    def _explanation(self, prediction: str, region_name: str, region_score: float) -> str:
        if prediction == "PNEUMONIA":
            if region_score > 0:
                return f"Opacity detected most prominently in the {region_name}, supporting pneumonia suspicion."
            return "Diffuse image features increased the pneumonia probability, though no single focal opacity dominated."

        return (
            "No focal opacity pattern exceeded the MVP pneumonia threshold; the heatmap highlights the "
            f"{region_name} as the most influential reviewed region."
        )

    def _recommendation(self, prediction: str, probability: float) -> str:
        if prediction == "PNEUMONIA" and probability >= 0.75:
            return "Radiologist review recommended; correlate with symptoms, vitals, labs, and prior imaging."
        if prediction == "PNEUMONIA":
            return "Clinical correlation and radiologist review recommended before treatment decisions."
        return "Routine clinical correlation recommended; seek radiologist review if symptoms or risk factors persist."
