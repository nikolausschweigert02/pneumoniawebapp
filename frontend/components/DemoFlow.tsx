import Link from "next/link";

type DemoStep = "upload" | "results" | "recommendations";

const STEPS = [
  { id: "upload" as const, label: "Upload", href: "/" },
  { id: "results" as const, label: "Results", href: "/results" },
  { id: "recommendations" as const, label: "Recommendations", href: "/recommendations" }
];

export function DemoFlow({ current }: { current: DemoStep }) {
  const currentIndex = STEPS.findIndex((step) => step.id === current);

  return (
    <nav
      aria-label="Demo flow"
      className="mb-8 rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur"
    >
      <ol className="grid gap-3 md:grid-cols-3">
        {STEPS.map((step, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = step.id === current;

          return (
            <li key={step.id}>
              <Link
                href={step.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 transition ${
                  isCurrent
                    ? "bg-sky-600 text-white shadow-sm"
                    : isComplete
                      ? "bg-sky-50 text-sky-900"
                      : "bg-slate-50 text-slate-600"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    isCurrent
                      ? "bg-white text-sky-700"
                      : isComplete
                        ? "bg-sky-600 text-white"
                        : "bg-white text-slate-500"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="font-semibold">{step.label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
