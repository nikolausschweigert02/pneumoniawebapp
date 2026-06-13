import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:8000";

export async function GET() {
  const response = await fetch(`${BACKEND_URL}/health`, { cache: "no-store" });
  const text = await response.text();

  return new NextResponse(text, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json"
    }
  });
}
