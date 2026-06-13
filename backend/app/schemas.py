from pydantic import BaseModel, Field


class PredictionResponse(BaseModel):
    prediction: str = Field(..., examples=["PNEUMONIA"])
    probability: float = Field(..., ge=0.0, le=1.0, examples=[0.91])
    confidence: str = Field(..., examples=["high"])
    explanation: str
    recommendation: str
    heatmap_url: str
    suspicious_region: str = Field(..., examples=["lower right lung"])
    region_opacity_score: float = Field(..., examples=[0.14])
    opacity_pattern: str = Field(..., examples=["focal"])
    key_findings: list[str]
    model_mode: str = Field(..., examples=["demo_heuristic"])
    model_name: str = Field(..., examples=["model1_resnet18_pneumonia"])
