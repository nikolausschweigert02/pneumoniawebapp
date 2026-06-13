"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { StoredAnalysis } from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function resolveHeatmapUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
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
  const [analysis] = useState<StoredAnalysis | null>(() => {
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
  });

  const heatmapUrl = analysis?.heatmap_url ? resolveHeatmapUrl(analysis.heatmap_url) : "";

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
        <Link
          href="/"
          className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Analyze another image
        </Link>
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
          <ResultCard title="Prediction" accent={isPneumonia ? "border-amber-200" : "border-emerald-200"}>
            <p className={`text-4xl font-bold ${isPneumonia ? "text-amber-700" : "text-emerald-700"}`}>
              {analysis.prediction}
            </p>
            <p className="mt-2 text-sm text-slate-500">Binary model output for pneumonia screening.</p>
          </ResultCard>

          <ResultCard title="Probability">
            <p className="text-4xl font-bold text-slate-950">{formatPercent(analysis.probability)}</p>
            <div className="mt-4 h-3 rounded-full bg-slate-100">
              <div
                className="h-3 rounded-full bg-sky-600"
                style={{ width: formatPercent(analysis.probability) }}
              />
            </div>
          </ResultCard>

          <ResultCard title="Confidence">
            <p className="text-4xl font-bold capitalize text-slate-950">{analysis.confidence}</p>
            <p className="mt-2 text-sm text-slate-500">Confidence is derived from probability distance from 50%.</p>
          </ResultCard>

          <ResultCard title="Grad-CAM heatmap">
            <div className="overflow-hidden rounded-2xl bg-slate-950">
              <Image
                src={heatmapUrl}
                alt="Grad-CAM heatmap visualization"
                width={720}
                height={720}
                unoptimized
                className="h-auto w-full object-contain"
              />
            </div>
          </ResultCard>

          <ResultCard title="AI explanation" accent="md:col-span-2 border-indigo-200">
            <p className="text-lg leading-8 text-slate-700">{analysis.explanation}</p>
          </ResultCard>

          <ResultCard title="Clinical recommendation" accent="md:col-span-2 border-sky-200">
            <p className="text-lg leading-8 text-slate-700">{analysis.recommendation}</p>
            <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">
              This MVP is decision-support software for demonstration and must not replace radiologist review,
              clinical exam findings, prior imaging, or laboratory context.
            </p>
          </ResultCard>
        </div>
      </div>
    </main>
  );
}
