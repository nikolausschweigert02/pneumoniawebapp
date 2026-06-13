export type ConfidenceLevel = "low" | "moderate" | "high";
export type OpacityPattern = "focal" | "multifocal_or_diffuse" | "subtle" | "low_suspicion";

export type PredictionResponse = {
  prediction: "PNEUMONIA" | "NORMAL";
  probability: number;
  confidence: ConfidenceLevel;
  explanation: string;
  recommendation: string;
  heatmap_url: string;
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
