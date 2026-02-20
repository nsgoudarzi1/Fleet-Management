import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/services/guard";

function windowStart(now: Date, windowSeconds: number) {
  const bucketMs = windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / bucketMs) * bucketMs);
}

export async function consumeRateLimit(input: {
  scope: string;
  key: string;
  limit: number;
  windowSeconds: number;
}) {
  const now = new Date();
  const start = windowStart(now, input.windowSeconds);
  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.apiRateLimit.upsert({
      where: {
        scope_key_windowStart: {
          scope: input.scope,
          key: input.key,
          windowStart: start,
        },
      },
      update: {
        count: { increment: 1 },
      },
      create: {
        scope: input.scope,
        key: input.key,
        windowStart: start,
        count: 1,
      },
      select: {
        count: true,
      },
    });
    return record.count;
  });

  const remaining = Math.max(0, input.limit - result);
  const resetAt = new Date(start.getTime() + input.windowSeconds * 1000);
  return {
    allowed: result <= input.limit,
    remaining,
    resetAt,
  };
}

export async function assertRateLimit(input: {
  scope: string;
  key: string;
  limit: number;
  windowSeconds: number;
}) {
  const result = await consumeRateLimit(input);
  if (!result.allowed) {
    throw new AppError("Rate limit exceeded. Please try again shortly.", 429);
  }
  return result;
}

export function requestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}
