from __future__ import annotations

import os
import sys
from io import BytesIO
from pathlib import Path
from typing import Any

import gradio as gr
import numpy as np
from PIL import Image, ImageOps

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.clinical_copy import DISCLAIMER_TEXT, PATIENT_TEXT  # noqa: E402
from app.model import PneumoniaPredictor  # noqa: E402

DEFAULT_MODELS_DIR = REPO_ROOT / "backend" / "models"
DEFAULT_CHECKPOINT = DEFAULT_MODELS_DIR / "model1_resnet18_pneumonia.pth"
DEFAULT_CONFIG = DEFAULT_MODELS_DIR / "model1_config.json"


def resolve_paths() -> tuple[Path, Path]:
    checkpoint = Path(os.getenv("PNEUMONIA_MODEL_PATH", DEFAULT_CHECKPOINT))
    config = Path(os.getenv("PNEUMONIA_MODEL_CONFIG", DEFAULT_CONFIG))
    return checkpoint, config


class PneumoniaGradioModel:
    """Thin Gradio wrapper around the same checkpoint inference path as the API."""

    def __init__(self) -> None:
        heatmap_dir = REPO_ROOT / "backend" / "static" / "heatmaps"
        self.predictor = PneumoniaPredictor(heatmap_dir=heatmap_dir)
        if not self.predictor.using_checkpoint:
            raise FileNotFoundError(
                "Trained checkpoint required for the scientific Gradio demo. "
                f"Expected checkpoint at {resolve_paths()[0]}."
            )

    def analyze(self, image: Image.Image | np.ndarray | None) -> tuple[Any, ...]:
        if image is None:
            raise gr.Error("Please upload a chest X-ray image.")

        if isinstance(image, np.ndarray):
            pil_image = Image.fromarray(image)
        else:
            pil_image = image

        buffer = io_bytes_from_image(pil_image)
        result = self.predictor.predict(buffer)

        original = ImageOps.exif_transpose(pil_image).convert("RGB")
        heatmap_path = REPO_ROOT / "backend" / "static" / "heatmaps" / Path(result["heatmap_url"]).name
        heatmap_overlay = Image.open(heatmap_path)

        return (
            original,
            result["screening_label"],
            f"{result['model_score_normal']:.4f}",
            f"{result['model_score_pneumonia']:.4f}",
            f"{result['screening_threshold']:.2f}",
            f"{result['confidence']} — {result['confidence_disclaimer']}",
            heatmap_overlay,
            result["gradcam_note"],
            result["recommendation"],
            PATIENT_TEXT,
            DISCLAIMER_TEXT,
            (
                f"### Screening result\n"
                f"**{result['screening_label']}**\n\n"
                f"- **Model score (NORMAL):** {result['model_score_normal']:.4f}\n"
                f"- **Model score (PNEUMONIA):** {result['model_score_pneumonia']:.4f}\n"
                f"- **Screening threshold:** {result['screening_threshold']:.2f}\n"
                f"- **Confidence (uncertainty-based):** {result['confidence']}\n\n"
                f"_{result['confidence_disclaimer']}_"
            ),
        )


def io_bytes_from_image(image: Image.Image) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def create_demo(model: PneumoniaGradioModel) -> gr.Blocks:
    with gr.Blocks(title="Chest X-ray Pneumonia Screening Demo") as demo:
        gr.Markdown(
            "# Chest X-ray pneumonia screening demo\n"
            "Upload a chest X-ray to view model scores, a raw Grad-CAM influence map, and educational screening text."
        )

        with gr.Row():
            with gr.Column(scale=1):
                image_input = gr.Image(label="Upload chest X-ray", type="pil")
                analyze_button = gr.Button("Analyze X-ray", variant="primary")
            with gr.Column(scale=1):
                original_output = gr.Image(label="Original image", type="pil")
                heatmap_output = gr.Image(label="Grad-CAM influence map", type="pil")

        with gr.Row():
            prediction_output = gr.Textbox(label="Screening result")
            threshold_output = gr.Textbox(label="Screening threshold")
            confidence_output = gr.Textbox(label="Confidence")

        with gr.Row():
            normal_score_output = gr.Textbox(label="Model score (NORMAL)")
            pneumonia_score_output = gr.Textbox(label="Model score (PNEUMONIA)")

        summary_output = gr.Markdown(label="Summary")
        gradcam_text_output = gr.Textbox(label="Grad-CAM note", lines=3)
        clinician_output = gr.Textbox(label="Clinician note", lines=4)
        patient_output = gr.Textbox(label="Patient note", lines=3)
        disclaimer_output = gr.Textbox(label="Disclaimer", lines=4)

        analyze_button.click(
            fn=model.analyze,
            inputs=[image_input],
            outputs=[
                original_output,
                prediction_output,
                normal_score_output,
                pneumonia_score_output,
                threshold_output,
                confidence_output,
                heatmap_output,
                gradcam_text_output,
                clinician_output,
                patient_output,
                disclaimer_output,
                summary_output,
            ],
        )

        gr.Markdown(f"_{DISCLAIMER_TEXT}_")

    return demo


def main() -> None:
    model = PneumoniaGradioModel()
    demo = create_demo(model)
    demo.launch(server_name="0.0.0.0", server_port=int(os.getenv("GRADIO_SERVER_PORT", "7860")))


if __name__ == "__main__":
    main()
