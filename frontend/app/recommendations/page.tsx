"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DemoFlow } from "@/components/DemoFlow";
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
  const [analysis, setAnalysis] = useState<StoredAnalysis | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate analysis from browser session
    setAnalysis(loadStoredAnalysis());
  }, []);

  if (!analysis) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-6 py-8">
        <DemoFlow current="recommendations" />
        <div className="rounded-3xl bg-white p-10 text-center shadow-xl">
          <h1 className="text-3xl font-bold text-slate-950">No recommendations yet</h1>
          <p className="mt-4 text-slate-600">Analyze a chest X-ray first.</p>
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

  const actionPlan = buildDoctorActionPlan(analysis);
  const pneumoniaScore = Math.round((analysis.model_score_pneumonia ?? analysis.probability) * 100);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-8">
      <DemoFlow current="recommendations" />

      <section className={`rounded-3xl border p-6 shadow-sm ${toneClasses(actionPlan.triageTone)}`}>
        <p className="text-sm font-semibold uppercase tracking-[0.2em]">Step 3 · Doctor action plan</p>
        <h1 className="mt-2 text-3xl font-bold">{actionPlan.triageLevel}</h1>
        <p className="mt-4 text-sm font-semibold">
          {analysis.screening_label ?? analysis.prediction} · {pneumoniaScore}% pneumonia score ·{" "}
          {analysis.confidence} confidence
        </p>
        <p className="mt-3 max-w-4xl text-base leading-7">{actionPlan.summary}</p>
      </section>

      <section className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Key findings for this case</h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {actionPlan.imageSpecificFindings.map((finding) => (
            <li key={finding} className="rounded-2xl bg-sky-50 p-4 text-sm leading-6 text-slate-800">
              {finding}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        {actionPlan.sections.map((section, sectionIndex) => (
          <article key={section.title} className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
                {sectionIndex + 1}
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-950">{section.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{section.description}</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2">
              {section.items.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-6 text-slate-700">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/results"
          className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back to results
        </Link>
        <Link
          href="/"
          className="rounded-2xl bg-sky-600 px-5 py-3 text-center font-semibold text-white hover:bg-sky-700"
        >
          Analyze another image
        </Link>
      </div>
    </main>
  );
}
