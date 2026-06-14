from __future__ import annotations

import torch.nn as nn
from torchvision.models import resnet18

SCREENING_THRESHOLD = 0.20
NORMAL_CLASS_INDEX = 0
PNEUMONIA_CLASS_INDEX = 1

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


def build_resnet18_classifier(num_classes: int = 2) -> nn.Module:
    """Recreate the trained ResNet18 pneumonia classifier architecture."""
    model = resnet18(weights=None)
    model.fc = nn.Sequential(
        nn.Dropout(0.4),
        nn.Linear(512, 256),
        nn.ReLU(),
        nn.Dropout(0.2),
        nn.Linear(256, num_classes),
    )
    return model
