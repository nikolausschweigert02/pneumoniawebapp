"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DemoFlow } from "@/components/DemoFlow";
import type { StoredAnalysis } from "@/lib/types";

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

export default function ResultsPage() {
  const [analysis, setAnalysis] = useState<StoredAnalysis | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate analysis from browser session
    setAnalysis(loadStoredAnalysis());
  }, []);

  if (!analysis) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-6 py-8">
        <DemoFlow current="results" />
        <div className="rounded-3xl bg-white p-10 text-center shadow-xl">
          <h1 className="text-3xl font-bold text-slate-950">No analysis found</h1>
          <p className="mt-4 text-slate-600">Upload and analyze a chest X-ray first.</p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-2xl bg-sky-600 px-6 py-3 font-semibold text-white hover:bg-sky-700"
          >
            Go to upload
          </Link>
        </div>
      </main>
    );
  }

  const isPneumonia = analysis.prediction === "PNEUMONIA";
  const pneumoniaScore = analysis.model_score_pneumonia ?? analysis.probability;
  const normalScore = analysis.model_score_normal ?? 1 - pneumoniaScore;
  const heatmapUrl = resolveHeatmapUrl(analysis.heatmap_url);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-8">
      <DemoFlow current="results" />

      <section
        className={`mb-6 rounded-3xl border p-6 shadow-sm ${
          isPneumonia ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"
        }`}
      >
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">Main result</p>
        <h1 className={`mt-2 text-3xl font-bold ${isPneumonia ? "text-amber-800" : "text-emerald-800"}`}>
          {analysis.screening_label ?? analysis.prediction}
        </h1>
        <p className="mt-3 text-sm text-slate-700">
          Pneumonia score: <strong>{formatPercent(pneumoniaScore)}</strong> · Normal score:{" "}
          <strong>{formatPercent(normalScore)}</strong> · Confidence:{" "}
          <strong className="capitalize">{analysis.confidence}</strong>
        </p>
        <p className="mt-2 text-sm text-slate-600">{analysis.fileName}</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">1. Original X-ray</h2>
          <div className="mt-4 overflow-hidden rounded-2xl bg-slate-950">
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

        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">2. Grad-CAM explanation</h2>
          <p className="mt-1 text-sm text-slate-500">Where the AI focused on the image</p>
          <div className="mt-4 overflow-hidden rounded-2xl bg-slate-950">
            <Image
              src={heatmapUrl}
              alt="Grad-CAM heatmap"
              width={720}
              height={720}
              unoptimized
              className="h-auto w-full object-contain"
            />
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {analysis.suspicious_region
              ? `Strongest influence: ${analysis.suspicious_region}. `
              : ""}
            The heatmap shows model influence, not proven pneumonia location.
          </p>
        </section>

        <section className="rounded-3xl border bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">3. How the AI decided</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Decision rule</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">≥ 20%</p>
              <p className="mt-2 text-sm text-slate-600">Pneumonia-like if pneumonia score reaches 20%.</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Model</p>
              <p className="mt-1 text-xl font-bold text-slate-900">ResNet18</p>
              <p className="mt-2 text-sm text-slate-600">Trained binary classifier: NORMAL vs PNEUMONIA.</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Important note</p>
              <p className="mt-2 text-sm text-slate-600">
                Model scores are not clinical probabilities. A doctor must review the X-ray.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-sky-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">4. Clinical recommendation</h2>
          <p className="mt-3 text-base leading-7 text-slate-700">{analysis.recommendation}</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/recommendations"
              className="inline-flex rounded-2xl bg-sky-600 px-5 py-3 text-center font-semibold text-white hover:bg-sky-700"
            >
              Continue to doctor recommendations
            </Link>
            <Link
              href="/"
              className="inline-flex rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center font-semibold text-slate-700 hover:bg-slate-50"
            >
              Analyze another image
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
