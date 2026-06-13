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
};

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

export default function ResultsPage() {
  const [analysis, setAnalysis] = useState<StoredAnalysis | null>(null);
  const [heatmapView, setHeatmapView] = useState<"overlay" | "raw">("overlay");
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);

  useEffect(() => {
    // Session storage is only available after client mount.
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
  const heatmapRawUrl = analysis?.heatmap_raw_url ? resolveHeatmapUrl(analysis.heatmap_raw_url) : heatmapUrl;
  const activeHeatmapUrl = heatmapView === "raw" ? heatmapRawUrl : heatmapUrl;

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
          <ResultCard title="Screening result" accent={isPneumonia ? "border-amber-200" : "border-emerald-200"}>
            <p className={`text-3xl font-bold leading-tight ${isPneumonia ? "text-amber-700" : "text-emerald-700"}`}>
              {analysis.screening_label ?? analysis.prediction}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Threshold-based screening output, not a clinical diagnosis.
            </p>
          </ResultCard>

          <ResultCard title="Model score (PNEUMONIA)">
            <p className="text-4xl font-bold text-slate-950">
              {formatPercent(analysis.model_score_pneumonia ?? analysis.probability)}
            </p>
            <div className="mt-4 h-3 rounded-full bg-slate-100">
              <div
                className="h-3 rounded-full bg-sky-600"
                style={{ width: formatPercent(analysis.model_score_pneumonia ?? analysis.probability) }}
              />
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Model score (NORMAL): {formatPercent(analysis.model_score_normal ?? 1 - analysis.probability)}
            </p>
          </ResultCard>

          <ResultCard title="Screening threshold">
            <p className="text-4xl font-bold text-slate-950">
              {formatPercent(analysis.screening_threshold ?? 0.2)}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              PNEUMONIA-like screening is triggered when the PNEUMONIA model score is at or above this value.
            </p>
          </ResultCard>

          <ResultCard title="Confidence">
            <p className="text-4xl font-bold capitalize text-slate-950">{analysis.confidence}</p>
            <p className="mt-2 text-sm text-slate-500">
              {analysis.confidence_disclaimer ??
                "This score is not calibrated and must not be interpreted as the clinical probability of pneumonia."}
            </p>
          </ResultCard>

          <ResultCard title="Grad-CAM influence map">
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setHeatmapView("overlay")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  heatmapView === "overlay"
                    ? "bg-sky-600 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Overlay on X-ray
              </button>
              <button
                type="button"
                onClick={() => setHeatmapView("raw")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  heatmapView === "raw"
                    ? "bg-sky-600 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Raw influence map
              </button>
            </div>
            <div className="overflow-hidden rounded-2xl bg-slate-950">
              <Image
                src={activeHeatmapUrl}
                alt={heatmapView === "raw" ? "Raw Grad-CAM influence map" : "Grad-CAM overlay"}
                width={720}
                height={720}
                unoptimized
                className="h-auto w-full object-contain"
              />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              {heatmapView === "raw"
                ? "Raw map shows model influence only, without blending onto the original X-ray."
                : analysis.gradcam_note ?? analysis.explanation}
            </p>
            {analysis.gradcam_class_explained !== undefined ? (
              <p className="mt-2 text-xs text-slate-400">
                Explained class: {analysis.gradcam_class_explained} (
                {analysis.gradcam_class_explained === 1 ? "PNEUMONIA" : "NORMAL"})
              </p>
            ) : null}
          </ResultCard>

          {modelInfo ? (
            <ResultCard title="Model info" accent="md:col-span-2 border-violet-200">
              <div className="grid gap-3 md:grid-cols-2">
                <p className="text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">Architecture:</span> {modelInfo.architecture}
                </p>
                <p className="text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">Mode:</span> {modelInfo.model_mode}
                </p>
                <p className="text-sm text-slate-700 md:col-span-2">
                  <span className="font-semibold text-slate-900">Classifier head:</span>{" "}
                  {modelInfo.classifier_head}
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
                <p className="text-sm text-slate-700 md:col-span-2">
                  <span className="font-semibold text-slate-900">Rule:</span> {modelInfo.screening_rule}
                </p>
              </div>
            </ResultCard>
          ) : null}

          <ResultCard title="Clinician note" accent="md:col-span-2 border-sky-200">
            <p className="text-lg leading-8 text-slate-700">{analysis.recommendation}</p>
            <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">
              Educational research demo only. Not a medical device. Grad-CAM highlights model influence regions
              and does not prove clinical correctness.
            </p>
            <Link
              href="/recommendations"
              className="mt-5 inline-flex rounded-2xl bg-sky-600 px-5 py-3 font-semibold text-white hover:bg-sky-700"
            >
              Continue to physician action plan
            </Link>
          </ResultCard>
        </div>
      </div>
    </main>
  );
}
