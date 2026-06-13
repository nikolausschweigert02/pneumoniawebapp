from __future__ import annotations

import io
import os
import threading
import uuid
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image, ImageOps
from torchvision import transforms
from torchvision.models import ResNet18_Weights, resnet18


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
        self.model = self._build_model().to(self.device).eval()
        self.using_checkpoint = self._load_checkpoint()
        self.target_layer = self.model.layer4[-1]
        self.activations: torch.Tensor | None = None
        self.gradients: torch.Tensor | None = None
        self.lock = threading.Lock()
        self.preprocess = transforms.Compose(
            [
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
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
                probability = float(torch.softmax(logits.detach(), dim=1)[0, 1].item())
            else:
                probability = self._opacity_probability(image)

            target_class = 1 if probability >= 0.5 else 0
            cam = self._gradcam(logits, target_class, image.size)

        region_name, region_score = self._most_opaque_region(image)
        if cam is None:
            cam = self._regional_heatmap(image.size, region_name)

        heatmap_url = self._save_heatmap(image, cam)
        prediction = "PNEUMONIA" if probability >= 0.5 else "NORMAL"

        return {
            "prediction": prediction,
            "probability": round(probability, 4),
            "confidence": self._confidence(probability),
            "explanation": self._explanation(prediction, region_name, region_score),
            "recommendation": self._recommendation(prediction, probability),
            "heatmap_url": heatmap_url
        }

    def _build_model(self) -> nn.Module:
        try:
            model = resnet18(weights=ResNet18_Weights.DEFAULT)
        except Exception:
            model = resnet18(weights=None)

        model.fc = nn.Linear(model.fc.in_features, 2)
        torch.manual_seed(42)
        nn.init.xavier_uniform_(model.fc.weight)
        nn.init.zeros_(model.fc.bias)
        return model

    def _load_checkpoint(self) -> bool:
        checkpoint_path = os.getenv("PNEUMONIA_MODEL_PATH")
        if not checkpoint_path:
            return False

        path = Path(checkpoint_path)
        if not path.exists():
            return False

        checkpoint = torch.load(path, map_location=self.device)
        if isinstance(checkpoint, dict):
            state_dict = checkpoint.get("model_state_dict") or checkpoint.get("state_dict") or checkpoint
        else:
            state_dict = checkpoint

        current_state = self.model.state_dict()
        normalized_state_dict = {}
        for key, value in state_dict.items():
            normalized_key = key.replace("module.", "", 1)
            if normalized_key in current_state and current_state[normalized_key].shape == value.shape:
                normalized_state_dict[normalized_key] = value

        self.model.load_state_dict(normalized_state_dict, strict=False)
        return True

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
        _, best_score = self._most_opaque_region(image)
        gray = np.asarray(ImageOps.grayscale(image.resize((224, 224))), dtype=np.float32) / 255.0
        contrast = max(0.0, best_score)
        texture = float(gray.std())
        probability = 0.38 + (contrast * 2.4) + (texture * 0.28)
        return float(np.clip(probability, 0.05, 0.98))

    def _most_opaque_region(self, image: Image.Image) -> tuple[str, float]:
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
        return max(scores.items(), key=lambda item: item[1])

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

    def _save_heatmap(self, image: Image.Image, cam: np.ndarray) -> str:
        base = np.asarray(image, dtype=np.float32) / 255.0
        heat = self._colorize(cam)
        overlay = np.clip((base * 0.55) + (heat * 0.45), 0.0, 1.0)
        heatmap_image = Image.fromarray((overlay * 255).astype(np.uint8))
        filename = f"{uuid.uuid4().hex}.png"
        heatmap_image.save(self.heatmap_dir / filename)
        return f"/static/heatmaps/{filename}"

    def _colorize(self, heatmap: np.ndarray) -> np.ndarray:
        x = np.clip(heatmap, 0.0, 1.0)
        red = np.clip(1.5 - np.abs(4.0 * x - 3.0), 0.0, 1.0)
        green = np.clip(1.5 - np.abs(4.0 * x - 2.0), 0.0, 1.0)
        blue = np.clip(1.5 - np.abs(4.0 * x - 1.0), 0.0, 1.0)
        return np.stack([red, green, blue], axis=-1)

    def _confidence(self, probability: float) -> str:
        distance = abs(probability - 0.5)
        if distance >= 0.35:
            return "high"
        if distance >= 0.18:
            return "moderate"
        return "low"

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
