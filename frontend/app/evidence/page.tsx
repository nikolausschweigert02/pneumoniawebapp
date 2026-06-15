import Link from "next/link";
import { ScientificReferencesFull } from "@/components/ScientificReferences";
import { methodSummary } from "@/lib/references";

export default function EvidencePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
            Scientific foundation
          </p>
          <h1 className="mt-2 text-4xl font-bold text-slate-950">Evidence & clinical guidelines</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{methodSummary}</p>
        </div>
        <Link
          href="/"
          className="rounded-2xl bg-sky-600 px-5 py-3 text-center font-semibold text-white shadow-sm hover:bg-sky-700"
        >
          Back to upload
        </Link>
      </div>

      <section className="mb-8 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm leading-7 text-amber-950">
        <strong>Clinical safety note:</strong> References support transparent decision support. They do not
        certify this application as a medical device. Final diagnosis and treatment require qualified
        clinician judgment, radiologist review, and local protocol.
      </section>

      <ScientificReferencesFull />
    </main>
  );
}
