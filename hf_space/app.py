from __future__ import annotations

import json
import os
from io import BytesIO
from pathlib import Path
from typing import Any

import gradio as gr
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from huggingface_hub import hf_hub_download
from PIL import Image, ImageOps
from torchvision import transforms
from torchvision.models import resnet18

SCREENING_THRESHOLD = 0.20
NORMAL_CLASS_INDEX = 0
PNEUMONIA_CLASS_INDEX = 1
APP_DIR = Path(__file__).resolve().parent
MODELS_DIR = APP_DIR / "models"
DEFAULT_CHECKPOINT = MODELS_DIR / "model1_resnet18_pneumonia.pth"
DEFAULT_CONFIG = MODELS_DIR / "model1_config.json"

CONFIDENCE_DISCLAIMER = (
    "This score is not calibrated and must not be interpreted as the clinical probability of pneumonia."
)
GRADCAM_NOTE = (
    "The heatmap highlights regions that influenced the model's prediction. "
    "It does not prove that pneumonia is present and should not be treated as a diagnostic explanation."
)
CLINICIAN_PNEUMONIA_TEXT = (
    "AI-assisted screening result: pneumonia-like pattern flagged. Please review the X-ray manually "
    "and correlate with symptoms, oxygen saturation, temperature, inflammatory markers, prior imaging "
    "and clinical context. Radiologist review is recommended before treatment decisions."
)
CLINICIAN_NORMAL_TEXT = (
    "AI-assisted screening result: normal-like pattern. A normal AI output does not rule out pneumonia. "
    "Please review the image manually and correlate with the clinical context."
)
PATIENT_TEXT = (
    "This demo cannot diagnose disease. The model result does not prove that you have or do not have "
    "pneumonia. A healthcare professional must interpret the X-ray together with symptoms and medical history."
)
DISCLAIMER_TEXT = (
    "Educational research demo only. Not a medical device. Not validated for clinical use. "
    "The result may be wrong and must not replace professional medical judgement. "
    "Grad-CAM is an inspection aid only and does not prove clinical correctness."
)


def build_resnet18_classifier(num_classes: int = 2) -> nn.Module:
    model = resnet18(weights=None)
    model.fc = nn.Sequential(
        nn.Dropout(0.4),
        nn.Linear(512, 256),
        nn.ReLU(),
        nn.Dropout(0.2),
        nn.Linear(256, num_classes),
    )
    return model


def resolve_model_paths() -> tuple[Path, Path]:
    checkpoint = Path(os.getenv("PNEUMONIA_MODEL_PATH", DEFAULT_CHECKPOINT))
    config = Path(os.getenv("PNEUMONIA_MODEL_CONFIG", DEFAULT_CONFIG))
    repo_id = os.getenv("MODEL_REPO_ID", "").strip()

    if repo_id:
        checkpoint = Path(
            hf_hub_download(
                repo_id=repo_id,
                filename=os.getenv("MODEL_CHECKPOINT_FILENAME", "model1_resnet18_pneumonia.pth"),
            )
        )
        config = Path(
            hf_hub_download(
                repo_id=repo_id,
                filename=os.getenv("MODEL_CONFIG_FILENAME", "model1_config.json"),
            )
        )

    return checkpoint, config


def _extract_state_dict(checkpoint: Any, checkpoint_key: str | None) -> dict[str, torch.Tensor]:
    if isinstance(checkpoint, dict):
        if checkpoint_key and checkpoint_key in checkpoint and isinstance(checkpoint[checkpoint_key], dict):
            return checkpoint[checkpoint_key]
        for key in ("model_state_dict", "state_dict", "model", "net"):
            candidate = checkpoint.get(key)
            if isinstance(candidate, dict):
                return candidate
        tensor_items = {key: value for key, value in checkpoint.items() if isinstance(value, torch.Tensor)}
        if tensor_items:
            return tensor_items
        return checkpoint
    raise ValueError("Unsupported checkpoint format.")


def _normalize_state_dict(model: nn.Module, state_dict: dict[str, torch.Tensor]) -> dict[str, torch.Tensor]:
    current_state = model.state_dict()
    normalized: dict[str, torch.Tensor] = {}
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
                normalized[candidate] = value
                break
    return normalized


class GradCAMGenerator:
    def __init__(self, model: nn.Module, target_layer: nn.Module) -> None:
        self.model = model
        self.target_layer = target_layer
        self.activations: torch.Tensor | None = None
        self.gradients: torch.Tensor | None = None
        self.target_layer.register_forward_hook(self._capture_activations)
        self.target_layer.register_full_backward_hook(self._capture_gradients)

    def _capture_activations(self, _module, _inputs, output) -> None:
        self.activations = output.detach()

    def _capture_gradients(self, _module, _grad_input, grad_output) -> None:
        self.gradients = grad_output[0].detach()

    def reset(self) -> None:
        self.activations = None
        self.gradients = None

    def generate(self, logits: torch.Tensor, target_class: int, image_size: tuple[int, int]) -> np.ndarray:
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


def overlay_gradcam(image: Image.Image, cam: np.ndarray) -> Image.Image:
    display_image = image.copy()
    cam_resized = np.asarray(
        Image.fromarray((cam * 255).astype(np.uint8)).resize(display_image.size, Image.Resampling.BILINEAR),
        dtype=np.float32,
    ) / 255.0
    base = np.asarray(display_image, dtype=np.float32) / 255.0
    heat = colorize_heatmap(cam_resized)
    alpha = np.clip((cam_resized - 0.10) / 0.90, 0.0, 1.0)[..., None] * 0.62
    overlay = np.clip((base * (1.0 - alpha)) + (heat * alpha), 0.0, 1.0)
    return Image.fromarray((overlay * 255).astype(np.uint8))


def confidence_from_threshold(p_pneumonia: float, threshold: float) -> str:
    distance = abs(p_pneumonia - threshold)
    if distance >= 0.35:
        return "high"
    if distance >= 0.15:
        return "moderate"
    return "low"


class PneumoniaScreeningApp:
    def __init__(self) -> None:
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.checkpoint_path, self.config_path = resolve_model_paths()
        self.config = self._load_config()
        self.model = build_resnet18_classifier().to(self.device).eval()
        self._load_checkpoint()
        self.gradcam = GradCAMGenerator(self.model, self.model.layer4[-1])
        self.preprocess = transforms.Compose(
            [
                transforms.Resize((self.config["image_size"], self.config["image_size"])),
                transforms.Grayscale(num_output_channels=3),
                transforms.ToTensor(),
                transforms.Normalize(mean=self.config["mean"], std=self.config["std"]),
            ]
        )

    def _load_config(self) -> dict[str, Any]:
        payload = json.loads(self.config_path.read_text(encoding="utf-8"))
        image_size = payload.get("image_size", 224)
        if isinstance(image_size, list):
            image_size = image_size[0]
        return {
            "image_size": int(image_size),
            "checkpoint_key": payload.get("checkpoint_key"),
            "mean": tuple(payload.get("mean", [0.485, 0.456, 0.406])),
            "std": tuple(payload.get("std", [0.229, 0.224, 0.225])),
        }

    def _load_checkpoint(self) -> None:
        if not self.checkpoint_path.exists():
            raise FileNotFoundError(
                "Model checkpoint missing. Upload model1_resnet18_pneumonia.pth to hf_space/models/ "
                "or set MODEL_REPO_ID to a Hugging Face model repository."
            )
        checkpoint = torch.load(self.checkpoint_path, map_location=self.device, weights_only=False)
        state_dict = _extract_state_dict(checkpoint, self.config["checkpoint_key"])
        normalized = _normalize_state_dict(self.model, state_dict)
        if not normalized:
            raise ValueError("Could not map checkpoint weights to the ResNet18 architecture.")
        self.model.load_state_dict(normalized, strict=False)

    def analyze(self, image: Image.Image | np.ndarray | None):
        if image is None:
            raise gr.Error("Please upload a chest X-ray image.")

        pil_image = Image.fromarray(image) if isinstance(image, np.ndarray) else image
        original = ImageOps.exif_transpose(pil_image).convert("RGB")
        tensor = self.preprocess(original).unsqueeze(0).to(self.device)
        self.gradcam.reset()
        self.model.zero_grad(set_to_none=True)

        with torch.enable_grad():
            logits = self.model(tensor)

        probabilities = torch.softmax(logits.detach(), dim=1)[0]
        p_normal = float(probabilities[NORMAL_CLASS_INDEX].item())
        p_pneumonia = float(probabilities[PNEUMONIA_CLASS_INDEX].item())

        if p_pneumonia >= SCREENING_THRESHOLD:
            screening_label = "PNEUMONIA-like pattern flagged"
            gradcam_class = PNEUMONIA_CLASS_INDEX
            clinician_text = CLINICIAN_PNEUMONIA_TEXT
        else:
            screening_label = "NORMAL-like pattern"
            gradcam_class = NORMAL_CLASS_INDEX
            clinician_text = CLINICIAN_NORMAL_TEXT

        cam = self.gradcam.generate(logits, gradcam_class, original.size)
        heatmap_overlay = overlay_gradcam(original, cam)
        confidence = confidence_from_threshold(p_pneumonia, SCREENING_THRESHOLD)

        return (
            original,
            screening_label,
            f"{p_normal:.4f}",
            f"{p_pneumonia:.4f}",
            f"{SCREENING_THRESHOLD:.2f}",
            f"{confidence} — {CONFIDENCE_DISCLAIMER}",
            heatmap_overlay,
            GRADCAM_NOTE,
            clinician_text,
            PATIENT_TEXT,
            DISCLAIMER_TEXT,
        )


def build_ui(app: PneumoniaScreeningApp) -> gr.Blocks:
    with gr.Blocks(title="Chest X-ray Pneumonia Screening") as demo:
        gr.Markdown(
            "# Chest X-ray pneumonia screening\n"
            "Upload a chest X-ray to view model scores, a Grad-CAM influence map, and educational screening text."
        )
        with gr.Row():
            with gr.Column():
                image_input = gr.Image(label="Upload chest X-ray", type="pil")
                analyze_button = gr.Button("Analyze X-ray", variant="primary")
            with gr.Column():
                original_output = gr.Image(label="Original image", type="pil")
                heatmap_output = gr.Image(label="Grad-CAM influence map", type="pil")
        with gr.Row():
            screening_output = gr.Textbox(label="Screening result")
            threshold_output = gr.Textbox(label="Screening threshold")
            confidence_output = gr.Textbox(label="Confidence")
        with gr.Row():
            normal_score_output = gr.Textbox(label="Model score (NORMAL)")
            pneumonia_score_output = gr.Textbox(label="Model score (PNEUMONIA)")
        gradcam_text_output = gr.Textbox(label="Grad-CAM note", lines=3)
        clinician_output = gr.Textbox(label="Clinician note", lines=4)
        patient_output = gr.Textbox(label="Patient note", lines=3)
        disclaimer_output = gr.Textbox(label="Disclaimer", lines=4)

        analyze_button.click(
            fn=app.analyze,
            inputs=[image_input],
            outputs=[
                original_output,
                screening_output,
                normal_score_output,
                pneumonia_score_output,
                threshold_output,
                confidence_output,
                heatmap_output,
                gradcam_text_output,
                clinician_output,
                patient_output,
                disclaimer_output,
            ],
        )
        gr.Markdown(f"_{DISCLAIMER_TEXT}_")
    return demo


APP = PneumoniaScreeningApp()
demo = build_ui(APP)

if __name__ == "__main__":
    demo.launch()
