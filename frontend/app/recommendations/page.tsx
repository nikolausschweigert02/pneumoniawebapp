"use client";

import Link from "next/link";
import { useState } from "react";
import { ScientificReferencesCompact } from "@/components/ScientificReferences";
import { buildDoctorActionPlan } from "@/lib/recommendations";
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

function toneClasses(tone: "amber" | "emerald" | "red") {
  if (tone === "red") {
    return "border-red-200 bg-red-50 text-red-800";
  }

  if (tone === "emerald") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  return "border-amber-200 bg-amber-50 text-amber-800";
}

export default function RecommendationsPage() {
  const [analysis] = useState<StoredAnalysis | null>(loadStoredAnalysis);

  if (!analysis) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
        <div className="rounded-3xl bg-white p-10 shadow-xl">
          <h1 className="text-3xl font-bold text-slate-950">No diagnosis available</h1>
          <p className="mt-4 text-slate-600">
            Analyze a chest X-ray first to generate physician action recommendations.
          </p>
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

  const actionPlan = buildDoctorActionPlan(analysis);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
            Physician action plan
          </p>
          <h1 className="mt-2 text-4xl font-bold text-slate-950">Recommended next steps</h1>
          <p className="mt-2 text-slate-600">{analysis.fileName}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/results"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Back to diagnosis
          </Link>
          <Link
            href="/"
            className="rounded-2xl bg-sky-600 px-5 py-3 text-center font-semibold text-white shadow-sm hover:bg-sky-700"
          >
            Analyze another image
          </Link>
        </div>
      </div>

      <section className={`rounded-3xl border p-6 shadow-sm ${toneClasses(actionPlan.triageTone)}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em]">Triage guidance</h2>
            <p className="mt-3 text-3xl font-bold">{actionPlan.triageLevel}</p>
          </div>
          <div className="rounded-2xl bg-white/70 px-5 py-4 text-sm font-semibold">
            {analysis.prediction} · {Math.round(analysis.probability * 100)}% · {analysis.confidence} confidence
          </div>
        </div>
        <p className="mt-5 max-w-4xl text-base leading-7">{actionPlan.summary}</p>
      </section>

      <section className="mt-6 rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-700">
          Image-specific findings used for this plan
        </h2>
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {actionPlan.imageSpecificFindings.map((finding) => (
            <li key={finding} className="rounded-2xl bg-indigo-50 p-4 text-sm leading-6 text-indigo-950">
              {finding}
            </li>
          ))}
          <li className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            Analysis mode: {analysis.model_mode === "trained_checkpoint" ? "trained checkpoint" : "MVP demo heuristic"}
            {analysis.model_name ? ` (${analysis.model_name})` : ""}
          </li>
        </ul>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        {actionPlan.sections.map((section, sectionIndex) => (
          <article key={section.title} className="rounded-3xl border border-white/80 bg-white p-6 shadow-sm">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 font-bold text-sky-700">
                {sectionIndex + 1}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-950">{section.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{section.description}</p>
              </div>
            </div>
            <ul className="mt-5 space-y-3">
              {section.items.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-slate-700">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Documentation note</h2>
        <p className="mt-3 leading-7 text-slate-600">
          Record the AI prediction, probability, heatmap region, clinician interpretation, and the final
          medical decision. Treatment pathways should follow ATS/IDSA CAP guidance (Metlay et al., 2019)
          and local protocol. This tool is advisory and does not replace radiologist review or physician
          judgment.
        </p>
      </section>

      <div className="mt-8">
        <ScientificReferencesCompact />
      </div>
    </main>
  );
}
