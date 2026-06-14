"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { StoredAnalysis } from "@/lib/types";

type ModelInfo = {
  architecture: string;
  classifier_head: string;
  classes: Record<string, string>;
  screening_threshold: number;
  screening_rule: string;
  preprocessing: string;
  gradcam_layer: string;
  gradcam_note: string;
  model_loaded: boolean;
  model_mode: string;
  model_name: string;
  model_summary?: string | null;
};

type HeatmapView = "overlay" | "blend" | "raw";

function loadStoredAnalysis() {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.sessionStorage.getItem("pneumonia-analysis");
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as StoredAnalysis;
  } catch {
    return null;
  }
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function resolveHeatmapUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return url.startsWith("/") ? url : `/${url}`;
}

function ResultCard({
  title,
  children,
  accent = "border-slate-200"
}: {
  title: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <section className={`rounded-3xl border bg-white p-6 shadow-sm ${accent}`}>
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ScoreBar({
  label,
  value,
  colorClass,
  threshold
}: {
  label: string;
  value: number;
  colorClass: string;
  threshold: number;
}) {
  const width = `${Math.max(0, Math.min(100, Math.round(value * 100)))}%`;
  const thresholdLeft = `${Math.round(threshold * 100)}%`;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold text-slate-900">{formatPercent(value)}</span>
      </div>
      <div className="relative h-3 rounded-full bg-slate-100">
        <div className={`h-3 rounded-full ${colorClass}`} style={{ width }} />
        <div
          className="absolute -top-1 bottom-0 w-0.5 bg-amber-500"
          style={{ left: thresholdLeft }}
          title={`${formatPercent(threshold)} screening threshold`}
        />
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const [analysis, setAnalysis] = useState<StoredAnalysis | null>(null);
  const [heatmapView, setHeatmapView] = useState<HeatmapView>("overlay");
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.62);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate analysis from browser session
    setAnalysis(loadStoredAnalysis());
  }, []);

  useEffect(() => {
    async function loadModelInfo() {
      try {
        const response = await fetch("/api/health");
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        setModelInfo(payload.model_info ?? null);
      } catch {
        setModelInfo(null);
      }
    }

    loadModelInfo();
  }, []);

  const heatmapUrl = analysis?.heatmap_url ? resolveHeatmapUrl(analysis.heatmap_url) : "";
  const heatmapRawUrl = analysis?.heatmap_raw_url
    ? resolveHeatmapUrl(analysis.heatmap_raw_url)
    : heatmapUrl;

  if (!analysis) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
        <div className="rounded-3xl bg-white p-10 shadow-xl">
          <h1 className="text-3xl font-bold text-slate-950">No analysis found</h1>
          <p className="mt-4 text-slate-600">Upload and analyze a chest X-ray to view explainable results.</p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-2xl bg-sky-600 px-6 py-3 font-semibold text-white hover:bg-sky-700"
          >
            Back to upload
          </Link>
        </div>
      </main>
    );
  }

  const isPneumonia = analysis.prediction === "PNEUMONIA";
  const pneumoniaScore = analysis.model_score_pneumonia ?? analysis.probability;
  const normalScore = analysis.model_score_normal ?? 1 - pneumoniaScore;
  const threshold = analysis.screening_threshold ?? 0.2;

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">Analysis results</p>
          <h1 className="mt-2 text-4xl font-bold text-slate-950">Explainable Pneumonia AI</h1>
          <p className="mt-2 text-slate-600">{analysis.fileName}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/recommendations"
            className="rounded-2xl bg-sky-600 px-5 py-3 text-center font-semibold text-white shadow-sm hover:bg-sky-700"
          >
            View doctor recommendations
          </Link>
          <Link
            href="/"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Analyze another image
          </Link>
        </div>
      </div>

      {analysis.image_quality_warnings?.length ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Image quality notes</p>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-800">
            {analysis.image_quality_warnings.map((warning) => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-xl shadow-slate-900/5">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Original image</h2>
          <div className="overflow-hidden rounded-2xl bg-slate-950">
            <Image
              src={analysis.originalImage}
              alt="Original chest X-ray"
              width={720}
              height={720}
              unoptimized
              className="h-auto w-full object-contain"
            />
          </div>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          <ResultCard title="AI screening result" accent={isPneumonia ? "border-amber-200" : "border-emerald-200"}>
            <p className={`text-3xl font-bold leading-tight ${isPneumonia ? "text-amber-700" : "text-emerald-700"}`}>
              {analysis.screening_label ?? analysis.prediction}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              AI-assisted screening only. This is not a final medical diagnosis.
            </p>
          </ResultCard>

          <ResultCard title="AI model scores">
            <div className="space-y-4">
              <ScoreBar
                label="Pneumonia score"
                value={pneumoniaScore}
                colorClass="bg-amber-500"
                threshold={threshold}
              />
              <ScoreBar label="Normal score" value={normalScore} colorClass="bg-emerald-500" threshold={threshold} />
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Amber line marks the {formatPercent(threshold)} screening threshold on the pneumonia score bar.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              These are model outputs from the neural network, not calibrated clinical probabilities.
            </p>
          </ResultCard>

          <ResultCard title="Decision rule">
            <p className="text-3xl font-bold text-slate-950">{formatPercent(threshold)}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The AI flags pneumonia-like patterns when the pneumonia score is at or above 20%.
            </p>
          </ResultCard>

          <ResultCard title="Confidence">
            <p className="text-4xl font-bold capitalize text-slate-950">{analysis.confidence}</p>
            <p className="mt-2 text-sm text-slate-500">
              {analysis.confidence_disclaimer ??
                "Based on how far the pneumonia score is from the decision threshold."}
            </p>
          </ResultCard>

          <ResultCard title="Grad-CAM heatmap" accent="md:col-span-2">
            <div className="mb-4 flex flex-wrap gap-2">
              {(
                [
                  ["overlay", "Blended overlay"],
                  ["blend", "Adjustable blend"],
                  ["raw", "Raw influence map"]
                ] as const
              ).map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setHeatmapView(view)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    heatmapView === view
                      ? "bg-sky-600 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="overflow-hidden rounded-2xl bg-slate-950">
              {heatmapView === "overlay" ? (
                <Image
                  src={heatmapUrl}
                  alt="Grad-CAM overlay on chest X-ray"
                  width={720}
                  height={720}
                  unoptimized
                  className="h-auto w-full object-contain"
                />
              ) : heatmapView === "raw" ? (
                <Image
                  src={heatmapRawUrl}
                  alt="Raw Grad-CAM influence map"
                  width={720}
                  height={720}
                  unoptimized
                  className="h-auto w-full object-contain"
                />
              ) : (
                <div className="relative">
                  <Image
                    src={analysis.originalImage}
                    alt="Original chest X-ray for blend comparison"
                    width={720}
                    height={720}
                    unoptimized
                    className="h-auto w-full object-contain"
                  />
                  <Image
                    src={heatmapRawUrl}
                    alt="Grad-CAM influence overlay"
                    width={720}
                    height={720}
                    unoptimized
                    style={{ opacity: heatmapOpacity }}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                </div>
              )}
            </div>

            {heatmapView === "blend" ? (
              <div className="mt-4">
                <label className="flex items-center justify-between text-sm text-slate-600">
                  <span>Heatmap opacity</span>
                  <span className="font-semibold text-slate-900">{Math.round(heatmapOpacity * 100)}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(heatmapOpacity * 100)}
                  onChange={(event) => setHeatmapOpacity(Number(event.target.value) / 100)}
                  className="mt-2 w-full accent-sky-600"
                />
              </div>
            ) : null}

            <p className="mt-3 text-sm leading-6 text-slate-500">
              {heatmapView === "raw"
                ? "Raw map shows model influence only, without blending onto the original X-ray."
                : heatmapView === "blend"
                  ? "Drag the slider to compare the original X-ray with the raw influence map."
                  : analysis.gradcam_note ??
                    "The heatmap shows which image regions influenced the AI. It does not prove pneumonia is present."}
            </p>
            {analysis.gradcam_class_explained !== undefined ? (
              <p className="mt-2 text-xs text-slate-400">
                Explained class: {analysis.gradcam_class_explained} (
                {analysis.gradcam_class_explained === 1 ? "PNEUMONIA" : "NORMAL"})
              </p>
            ) : null}
          </ResultCard>

          <ResultCard title="AI explanation" accent="border-indigo-200">
            <p className="text-lg leading-8 text-slate-700">
              {analysis.suspicious_region
                ? `The strongest model influence was in the ${analysis.suspicious_region}.`
                : analysis.explanation}
            </p>
            {analysis.opacity_pattern ? (
              <p className="mt-3 text-sm text-slate-500">
                Opacity pattern: <span className="font-medium text-slate-700">{analysis.opacity_pattern}</span>
              </p>
            ) : null}
          </ResultCard>

          {analysis.key_findings?.length ? (
            <ResultCard title="Key findings" accent="border-slate-200">
              <ul className="space-y-2 text-sm leading-7 text-slate-700">
                {analysis.key_findings.map((finding) => (
                  <li key={finding} className="flex gap-2">
                    <span className="text-sky-500">•</span>
                    <span>{finding}</span>
                  </li>
                ))}
              </ul>
            </ResultCard>
          ) : null}

          {modelInfo ? (
            <ResultCard title="Model info" accent="md:col-span-2 border-violet-100 bg-violet-50/40">
              <div className="grid gap-3 md:grid-cols-2">
                <p className="text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">Architecture:</span> {modelInfo.architecture}
                </p>
                <p className="text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">Mode:</span> {modelInfo.model_mode}
                </p>
                <p className="text-sm text-slate-700 md:col-span-2">
                  <span className="font-semibold text-slate-900">Classifier head:</span> {modelInfo.classifier_head}
                </p>
                <p className="text-sm text-slate-700 md:col-span-2">
                  <span className="font-semibold text-slate-900">Preprocessing:</span> {modelInfo.preprocessing}
                </p>
                <p className="text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">Screening threshold:</span>{" "}
                  {modelInfo.screening_threshold}
                </p>
                <p className="text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">Grad-CAM layer:</span> {modelInfo.gradcam_layer}
                </p>
                {modelInfo.model_summary ? (
                  <p className="text-sm text-slate-700 md:col-span-2">
                    <span className="font-semibold text-slate-900">Summary:</span> {modelInfo.model_summary}
                  </p>
                ) : null}
              </div>
            </ResultCard>
          ) : null}

          <ResultCard title="Clinical recommendation" accent="md:col-span-2 border-sky-200">
            <p className="text-lg leading-8 text-slate-700">{analysis.recommendation}</p>
            <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">
              Educational research demo only. Not a medical device. A doctor must always review the X-ray,
              symptoms, and clinical findings.
            </p>
            <Link
              href="/recommendations"
              className="mt-5 inline-flex rounded-2xl bg-sky-600 px-5 py-3 font-semibold text-white hover:bg-sky-700"
            >
              Continue to physician action plan
            </Link>
          </ResultCard>

          <ResultCard title="How this AI works" accent="md:col-span-2 border-violet-100 bg-violet-50/40">
            <ul className="space-y-2 text-sm leading-7 text-slate-700">
              <li>• Uses a trained ResNet18 model for binary chest X-ray screening.</li>
              <li>• Applies a 20% pneumonia-score threshold instead of a simple winner-takes-all decision.</li>
              <li>• Grad-CAM highlights image regions that influenced the model output.</li>
              <li>• The heatmap is an explanation tool, not proof of disease location.</li>
            </ul>
          </ResultCard>
        </div>
      </div>
    </main>
  );
}
