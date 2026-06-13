from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
DEFAULT_CHECKPOINT = MODELS_DIR / "model1_resnet18_pneumonia.pth"
DEFAULT_CONFIG = MODELS_DIR / "model1_config.json"
DEFAULT_SUMMARY = MODELS_DIR / "model1_summary.txt"


@dataclass(frozen=True)
class ModelConfig:
    architecture: str = "resnet18"
    model_name: str = "model1_resnet18_pneumonia"
    num_classes: int = 2
    class_names: tuple[str, ...] = ("NORMAL", "PNEUMONIA")
    pneumonia_class_index: int = 1
    image_size: int = 224
    mean: tuple[float, float, float] = (0.485, 0.456, 0.406)
    std: tuple[float, float, float] = (0.229, 0.224, 0.225)
    checkpoint_key: str | None = None

    @property
    def pneumonia_label(self) -> str:
        if 0 <= self.pneumonia_class_index < len(self.class_names):
            return self.class_names[self.pneumonia_class_index]
        return "PNEUMONIA"


def resolve_checkpoint_path() -> Path | None:
    configured = os.getenv("PNEUMONIA_MODEL_PATH")
    if configured:
        path = Path(configured)
        return path if path.exists() else None

    if DEFAULT_CHECKPOINT.exists():
        return DEFAULT_CHECKPOINT

    return None


def resolve_config_path() -> Path | None:
    configured = os.getenv("PNEUMONIA_MODEL_CONFIG")
    if configured:
        path = Path(configured)
        return path if path.exists() else None

    if DEFAULT_CONFIG.exists():
        return DEFAULT_CONFIG

    return None


def resolve_summary_path() -> Path | None:
    configured = os.getenv("PNEUMONIA_MODEL_SUMMARY")
    if configured:
        path = Path(configured)
        return path if path.exists() else None

    if DEFAULT_SUMMARY.exists():
        return DEFAULT_SUMMARY

    return None


def _as_float_tuple(values: list | tuple, fallback: tuple[float, float, float]) -> tuple[float, float, float]:
    if len(values) != 3:
        return fallback
    return (float(values[0]), float(values[1]), float(values[2]))


def load_model_config(path: Path | None = None) -> ModelConfig:
    config_path = path or resolve_config_path()
    if config_path is None:
        return ModelConfig()

    payload = json.loads(config_path.read_text(encoding="utf-8"))
    class_names = payload.get("class_names") or payload.get("classes") or payload.get("labels")
    if isinstance(class_names, list) and class_names:
        class_names_tuple = tuple(str(name) for name in class_names)
    else:
        class_names_tuple = ModelConfig().class_names

    pneumonia_index = payload.get("pneumonia_class_index")
    if pneumonia_index is None:
        pneumonia_index = next(
            (index for index, name in enumerate(class_names_tuple) if name.upper() == "PNEUMONIA"),
            1
        )

    image_size = payload.get("image_size") or payload.get("img_size") or payload.get("input_size") or 224
    if isinstance(image_size, list):
        image_size = image_size[0]

    return ModelConfig(
        architecture=str(payload.get("architecture") or payload.get("model_name") or "resnet18"),
        model_name=str(payload.get("model_id") or payload.get("name") or "model1_resnet18_pneumonia"),
        num_classes=int(payload.get("num_classes") or len(class_names_tuple)),
        class_names=class_names_tuple,
        pneumonia_class_index=int(pneumonia_index),
        image_size=int(image_size),
        mean=_as_float_tuple(payload.get("mean", []), ModelConfig().mean),
        std=_as_float_tuple(payload.get("std", []), ModelConfig().std),
        checkpoint_key=payload.get("checkpoint_key")
    )


def load_model_summary(path: Path | None = None) -> str:
    summary_path = path or resolve_summary_path()
    if summary_path is None:
        return ""

    return summary_path.read_text(encoding="utf-8").strip()
