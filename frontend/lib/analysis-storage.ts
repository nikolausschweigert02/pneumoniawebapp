import type { StoredAnalysis } from "@/lib/types";

const ANALYSIS_KEY = "pneumonia-analysis";

function normalizeAnalysis(
  parsed: Partial<StoredAnalysis> & { fileName?: string; originalImage?: string }
): StoredAnalysis | null {
  if (!parsed.prediction) {
    return null;
  }

  const pneumoniaScore = parsed.model_score_pneumonia ?? parsed.probability ?? 0;

  return {
    prediction: parsed.prediction,
    screening_label: parsed.screening_label ?? parsed.prediction,
    probability: parsed.probability ?? pneumoniaScore,
    model_score_normal: parsed.model_score_normal ?? 1 - pneumoniaScore,
    model_score_pneumonia: pneumoniaScore,
    screening_threshold: parsed.screening_threshold ?? 0.2,
    confidence: parsed.confidence ?? "moderate",
    confidence_disclaimer: parsed.confidence_disclaimer ?? "",
    explanation: parsed.explanation ?? "",
    gradcam_note: parsed.gradcam_note ?? "",
    recommendation: parsed.recommendation ?? "",
    heatmap_url: parsed.heatmap_url ?? "",
    heatmap_raw_url: parsed.heatmap_raw_url ?? parsed.heatmap_url ?? "",
    gradcam_class_explained:
      parsed.gradcam_class_explained ?? (parsed.prediction === "PNEUMONIA" ? 1 : 0),
    image_quality_warnings: parsed.image_quality_warnings ?? [],
    suspicious_region: parsed.suspicious_region ?? "",
    region_opacity_score: parsed.region_opacity_score ?? 0,
    opacity_pattern: parsed.opacity_pattern ?? "low_suspicion",
    key_findings: parsed.key_findings ?? [],
    model_mode: parsed.model_mode ?? "demo_heuristic",
    model_name: parsed.model_name ?? "unknown",
    originalImage: parsed.originalImage ?? "",
    fileName: parsed.fileName ?? "chest-xray.jpg"
  };
}

export function loadStoredAnalysis(): StoredAnalysis | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.sessionStorage.getItem(ANALYSIS_KEY);
  if (!stored) {
    return null;
  }

  try {
    return normalizeAnalysis(JSON.parse(stored) as Partial<StoredAnalysis>);
  } catch {
    return null;
  }
}

async function compressImageDataUrl(dataUrl: string, maxEdge = 720, quality = 0.82): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const image = new window.Image();
    image.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");

      if (!context) {
        resolve(dataUrl);
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

export async function saveStoredAnalysis(analysis: StoredAnalysis): Promise<void> {
  const compressedImage = await compressImageDataUrl(analysis.originalImage);
  const payload: StoredAnalysis = {
    ...analysis,
    originalImage: compressedImage
  };

  try {
    window.sessionStorage.setItem(ANALYSIS_KEY, JSON.stringify(payload));
  } catch {
    const { originalImage: _originalImage, ...withoutImage } = payload;
    window.sessionStorage.setItem(ANALYSIS_KEY, JSON.stringify(withoutImage));
  }
}
