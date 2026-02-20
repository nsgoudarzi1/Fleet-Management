import { NextResponse } from "next/server";
import { AppError } from "@/lib/services/guard";
import { logger } from "@/lib/logger";

export async function readJsonWithLimit<T = unknown>(request: Request, maxBytes: number) {
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader && Number(contentLengthHeader) > maxBytes) {
    throw new AppError(`Request payload exceeds ${maxBytes} bytes.`, 413);
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new AppError(`Request payload exceeds ${maxBytes} bytes.`, 413);
  }
  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AppError("Invalid JSON payload.", 400);
  }
}

export function handleRouteError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  logger.error("Unhandled route error", {
    error: error instanceof Error ? error.message : String(error),
  });
  return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
}
