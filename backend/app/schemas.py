from __future__ import annotations

from pydantic import BaseModel, Field


class PredictionResponse(BaseModel):
    prediction: str = Field(..., examples=["PNEUMONIA"])
    screening_label: str = Field(..., examples=["PNEUMONIA-like pattern flagged"])
    probability: float = Field(..., ge=0.0, le=1.0, examples=[0.91])
    model_score_normal: float = Field(..., ge=0.0, le=1.0, examples=[0.09])
    model_score_pneumonia: float = Field(..., ge=0.0, le=1.0, examples=[0.91])
    screening_threshold: float = Field(..., examples=[0.20])
    confidence: str = Field(..., examples=["high"])
    confidence_disclaimer: str
    explanation: str
    gradcam_note: str
    recommendation: str
    heatmap_url: str
    heatmap_raw_url: str
    gradcam_class_explained: int = Field(..., examples=[1])
    suspicious_region: str = Field(..., examples=["lower right lung field"])
    region_opacity_score: float = Field(..., examples=[0.14])
    opacity_pattern: str = Field(..., examples=["focal"])
    key_findings: list[str]
    model_mode: str = Field(..., examples=["trained_checkpoint"])
    model_name: str = Field(..., examples=["model1_resnet18_pneumonia"])
