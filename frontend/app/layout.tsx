import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Explainable Pneumonia AI",
  description: "MVP for pneumonia detection with confidence, Grad-CAM heatmaps, and clinical guidance."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
          <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4 text-sm font-semibold text-slate-700">
            <Link href="/" className="text-slate-950">
              Explainable Pneumonia AI
            </Link>
            <div className="flex flex-wrap gap-3">
              <Link href="/" className="rounded-xl px-3 py-2 hover:bg-slate-100">
                Upload
              </Link>
              <Link href="/results" className="rounded-xl px-3 py-2 hover:bg-slate-100">
                Results
              </Link>
              <Link href="/recommendations" className="rounded-xl px-3 py-2 hover:bg-slate-100">
                Recommendations
              </Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
