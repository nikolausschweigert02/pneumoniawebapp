import Link from "next/link";
import {
  referenceCategoryLabels,
  scientificReferences,
  type ReferenceCategory,
  type ScientificReference
} from "@/lib/references";

function ReferenceCard({ reference }: { reference: ScientificReference }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-800">
          {referenceCategoryLabels[reference.category]}
        </span>
        <span className="text-xs font-medium text-slate-500">{reference.impactNote}</span>
      </div>
      <h3 className="mt-3 text-base font-semibold leading-7 text-slate-950">{reference.title}</h3>
      <p className="mt-2 text-sm text-slate-600">
        {reference.authors} ({reference.year}). <em>{reference.journal}</em>
        {reference.doi ? (
          <>
            {" "}
            · DOI:{" "}
            <a href={reference.url} className="text-sky-700 underline-offset-2 hover:underline">
              {reference.doi}
            </a>
          </>
        ) : null}
      </p>
      <p className="mt-3 text-sm leading-6 text-slate-700">{reference.relevance}</p>
      <a
        href={reference.url}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex text-sm font-semibold text-sky-700 hover:text-sky-800"
      >
        Open source reference
      </a>
    </article>
  );
}

export function ScientificReferencesCompact() {
  const featuredCategories: ReferenceCategory[] = ["explainability", "guideline", "model"];

  return (
    <section className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-700">
            Evidence base
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Methodology and recommendations are anchored in high-impact literature and established
            pneumonia guidelines.
          </p>
        </div>
        <Link
          href="/evidence"
          className="inline-flex rounded-2xl border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
        >
          View full bibliography
        </Link>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {featuredCategories.map((category) => {
          const reference = scientificReferences.find((item) => item.category === category);
          if (!reference) {
            return null;
          }

          return (
            <div key={reference.id} className="rounded-2xl bg-indigo-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                {referenceCategoryLabels[category]}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{reference.title}</p>
              <p className="mt-2 text-xs text-slate-600">
                {reference.authors} ({reference.year})
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ScientificReferencesFull() {
  const categories: ReferenceCategory[] = [
    "dataset",
    "model",
    "explainability",
    "review",
    "guideline"
  ];

  return (
    <div className="space-y-8">
      {categories.map((category) => {
        const items = scientificReferences.filter((reference) => reference.category === category);
        if (items.length === 0) {
          return null;
        }

        return (
          <section key={category}>
            <h2 className="text-xl font-bold text-slate-950">{referenceCategoryLabels[category]}</h2>
            <div className="mt-4 grid gap-4">
              {items.map((reference) => (
                <ReferenceCard key={reference.id} reference={reference} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
