export type ConfidenceLevel = "low" | "moderate" | "high";

export type PredictionResponse = {
  prediction: "PNEUMONIA" | "NORMAL";
  probability: number;
  confidence: ConfidenceLevel;
  explanation: string;
  recommendation: string;
  heatmap_url: string;
};

export type StoredAnalysis = PredictionResponse & {
  originalImage: string;
  fileName: string;
};
