export type ConfidenceLevel = "low" | "moderate" | "high";
export type OpacityPattern = "focal" | "multifocal_or_diffuse" | "subtle" | "low_suspicion";

export type PredictionResponse = {
  prediction: "PNEUMONIA" | "NORMAL";
  screening_label: string;
  probability: number;
  model_score_normal: number;
  model_score_pneumonia: number;
  screening_threshold: number;
  confidence: ConfidenceLevel;
  confidence_disclaimer: string;
  explanation: string;
  gradcam_note: string;
  recommendation: string;
  heatmap_url: string;
  heatmap_raw_url: string;
  gradcam_class_explained: number;
  image_quality_warnings: string[];
  suspicious_region: string;
  region_opacity_score: number;
  opacity_pattern: OpacityPattern;
  key_findings: string[];
  model_mode: "trained_checkpoint" | "demo_heuristic";
  model_name: string;
};

export type StoredAnalysis = PredictionResponse & {
  originalImage: string;
  fileName: string;
};
