from __future__ import annotations

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image


class GradCAMGenerator:
    """Standard Grad-CAM on a convolutional target layer without post-hoc masking."""

    def __init__(self, model: nn.Module, target_layer: nn.Module) -> None:
        self.model = model
        self.target_layer = target_layer
        self.activations: torch.Tensor | None = None
        self.gradients: torch.Tensor | None = None
        self.target_layer.register_forward_hook(self._capture_activations)
        self.target_layer.register_full_backward_hook(self._capture_gradients)

    def _capture_activations(
        self,
        _module: nn.Module,
        _inputs: tuple[torch.Tensor, ...],
        output: torch.Tensor,
    ) -> None:
        self.activations = output.detach()

    def _capture_gradients(
        self,
        _module: nn.Module,
        _grad_input: tuple[torch.Tensor, ...],
        grad_output: tuple[torch.Tensor, ...],
    ) -> None:
        self.gradients = grad_output[0].detach()

    def reset(self) -> None:
        self.activations = None
        self.gradients = None

    def generate(
        self,
        logits: torch.Tensor,
        target_class: int,
        image_size: tuple[int, int],
    ) -> np.ndarray:
        score = logits[0, target_class]
        self.model.zero_grad(set_to_none=True)
        score.backward(retain_graph=False)

        if self.activations is None or self.gradients is None:
            raise RuntimeError("Grad-CAM hooks did not capture activations or gradients.")

        weights = self.gradients.mean(dim=(2, 3), keepdim=True)
        cam = torch.relu((weights * self.activations).sum(dim=1, keepdim=True))
        cam = F.interpolate(cam, size=(image_size[1], image_size[0]), mode="bilinear", align_corners=False)
        cam_np = cam.squeeze().detach().cpu().numpy()
        cam_min = float(cam_np.min())
        cam_max = float(cam_np.max())

        if cam_max - cam_min < 1e-8:
            return np.zeros((image_size[1], image_size[0]), dtype=np.float32)

        return ((cam_np - cam_min) / (cam_max - cam_min)).astype(np.float32)


def colorize_heatmap(heatmap: np.ndarray) -> np.ndarray:
    x = np.clip(heatmap, 0.0, 1.0)
    red = np.clip(2.2 * x, 0.0, 1.0)
    green = np.clip(1.8 * x - 0.25, 0.0, 1.0)
    blue = np.clip(0.45 - x, 0.0, 0.45) / 0.45
    return np.stack([red, green, blue], axis=-1)


def overlay_gradcam(image: Image.Image, cam: np.ndarray, alpha_strength: float = 0.62) -> Image.Image:
    """Blend a raw Grad-CAM map onto the original image without anatomical masking."""
    display_image = image.copy()
    cam_resized = np.asarray(
        Image.fromarray((cam * 255).astype(np.uint8)).resize(display_image.size, Image.Resampling.BILINEAR),
        dtype=np.float32,
    ) / 255.0

    base = np.asarray(display_image, dtype=np.float32) / 255.0
    heat = colorize_heatmap(cam_resized)
    alpha = np.clip((cam_resized - 0.10) / 0.90, 0.0, 1.0)[..., None] * alpha_strength
    overlay = np.clip((base * (1.0 - alpha)) + (heat * alpha), 0.0, 1.0)
    return Image.fromarray((overlay * 255).astype(np.uint8))


def render_raw_gradcam(cam: np.ndarray, image_size: tuple[int, int]) -> Image.Image:
    """Render the colormap Grad-CAM without blending onto the original X-ray."""
    cam_resized = np.asarray(
        Image.fromarray((cam * 255).astype(np.uint8)).resize(image_size, Image.Resampling.BILINEAR),
        dtype=np.float32,
    ) / 255.0
    heat = colorize_heatmap(cam_resized)
    return Image.fromarray((heat * 255).astype(np.uint8))


def peak_region_from_cam(cam: np.ndarray) -> tuple[str, float]:
    """Map the strongest Grad-CAM activation to a coarse lung quadrant label."""
    if cam.size == 0 or float(cam.max()) <= 0.0:
        return "central image field", 0.0

    height, width = cam.shape
    regions = {
        "upper left lung field": cam[int(height * 0.24):int(height * 0.52), int(width * 0.14):int(width * 0.46)],
        "upper right lung field": cam[int(height * 0.24):int(height * 0.52), int(width * 0.54):int(width * 0.86)],
        "lower left lung field": cam[int(height * 0.54):int(height * 0.88), int(width * 0.14):int(width * 0.46)],
        "lower right lung field": cam[int(height * 0.54):int(height * 0.88), int(width * 0.54):int(width * 0.86)],
    }
    region_name, region_values = max(regions.items(), key=lambda item: float(item[1].mean()))
    return region_name, float(region_values.mean())


def confidence_from_threshold(p_pneumonia: float, threshold: float) -> str:
    distance = abs(p_pneumonia - threshold)
    if distance >= 0.35:
        return "high"
    if distance >= 0.15:
        return "moderate"
    return "low"
