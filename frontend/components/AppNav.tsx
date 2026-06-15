import Link from "next/link";

const links = [
  { href: "/", label: "Upload" },
  { href: "/evidence", label: "Evidence" }
];

export default function AppNav() {
  return (
    <header className="border-b border-white/70 bg-white/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-800">
          Explainable Pneumonia AI
        </Link>
        <nav className="flex items-center gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
