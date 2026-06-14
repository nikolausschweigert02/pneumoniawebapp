import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Explainable Pneumonia AI",
  description: "Explainable pneumonia screening with confidence, Grad-CAM heatmaps, and clinical guidance."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
