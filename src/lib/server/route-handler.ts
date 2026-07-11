import { createHash } from "node:crypto";

import { z } from "zod";

import { PublicApiError } from "@/lib/server/errors";

type SuccessEnvelope<T> = { data: T };
type ErrorEnvelope = { error: string; retryable: boolean };

interface StoredResult<T> {
  body: SuccessEnvelope<T> | ErrorEnvelope;
  status: number;
  headers?: Record<string, string>;
}

interface IdempotencyEntry {
  expiresAt: number;
  value: Promise<StoredResult<unknown>>;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

const idempotencyEntries = new Map<string, IdempotencyEntry>();
const rateBuckets = new Map<string, RateBucket>();

export interface JsonPostOptions<TInput, TOutput> {
  request: Request;
  routeId: string;
  schema: z.ZodType<TInput>;
  handler: (input: TInput, context: { signal: AbortSignal }) => Promise<TOutput>;
  maxBodyBytes?: number;
  timeoutMs?: number;
}

function envInteger(name: string, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function responseHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    "cache-control": "no-store, max-age=0",
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
    ...extra,
  };
}

function toResponse<T>(result: StoredResult<T>): Response {
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: responseHeaders(result.headers),
  });
}

export function jsonSuccess<T>(data: T, status = 200): Response {
  return toResponse({ body: { data }, status });
}

export function jsonError(
  error: string,
  status: number,
  retryable = false,
  headers?: Record<string, string>,
): Response {
  return toResponse({ body: { error, retryable }, status, headers });
}

function clientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const value = forwarded || request.headers.get("x-real-ip")?.trim() || "local";
  return value.slice(0, 80);
}

function pruneExpired(now: number): void {
  if (idempotencyEntries.size > 256) {
    for (const [key, entry] of idempotencyEntries) {
      if (entry.expiresAt <= now) idempotencyEntries.delete(key);
    }
  }

  if (rateBuckets.size > 512) {
    for (const [key, bucket] of rateBuckets) {
      if (bucket.resetAt <= now) rateBuckets.delete(key);
    }
  }
}

function takeRateLimitSlot(request: Request, routeId: string): number | null {
  const now = Date.now();
  const windowMs = envInteger("AI_RATE_LIMIT_WINDOW_MS", 60_000, 1_000, 3_600_000);
  const maximum = envInteger("AI_RATE_LIMIT_MAX", 24, 1, 1_000);
  const key = `${routeId}:${clientIdentifier(request)}`;
  const current = rateBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (current.count >= maximum) {
    return Math.max(1, Math.ceil((current.resetAt - now) / 1_000));
  }

  current.count += 1;
  return null;
}

function validationMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "请求参数无效。";
  const path = issue.path.length > 0 ? `${issue.path.join(".")}：` : "";
  return `请求参数无效：${path}${issue.message}`;
}

function safeFailure(error: unknown): StoredResult<never> {
  if (error instanceof PublicApiError) {
    return {
      body: { error: error.message, retryable: error.retryable },
      status: error.status,
    };
  }

  return {
    body: { error: "服务暂时不可用，请稍后重试。", retryable: true },
    status: 500,
  };
}

async function runWithTimeout<T>(
  requestSignal: AbortSignal,
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;

  const forwardAbort = () => controller.abort(requestSignal.reason);
  requestSignal.addEventListener("abort", forwardAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException("Request timed out", "AbortError"));
  }, timeoutMs);

  try {
    return await operation(controller.signal);
  } catch (error) {
    if (timedOut) {
      throw new PublicApiError("AI 请求超时，请稍后重试。", 504, true);
    }
    if (requestSignal.aborted) {
      throw new PublicApiError("请求已取消。", 408, true);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    requestSignal.removeEventListener("abort", forwardAbort);
  }
}

async function readBody(request: Request, maximumBytes: number): Promise<string> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    throw new PublicApiError("请求必须使用 application/json。", 415, false);
  }

  const declaredLength = Number.parseInt(request.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new PublicApiError("请求内容过大。", 413, false);
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maximumBytes) {
    throw new PublicApiError("请求内容过大。", 413, false);
  }
  return raw;
}

export async function handleJsonPost<TInput, TOutput>(
  options: JsonPostOptions<TInput, TOutput>,
): Promise<Response> {
  const {
    request,
    routeId,
    schema,
    handler,
    maxBodyBytes = 64 * 1024,
    timeoutMs = envInteger("AI_REQUEST_TIMEOUT_MS", 45_000, 5_000, 120_000),
  } = options;

  try {
    const raw = await readBody(request, maxBodyBytes);
    let json: unknown;
    try {
      json = JSON.parse(raw) as unknown;
    } catch {
      throw new PublicApiError("请求 JSON 格式无效。", 400, false);
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return jsonError(validationMessage(parsed.error), 400, false);
    }

    const now = Date.now();
    pruneExpired(now);
    const bodyHash = createHash("sha256").update(raw).digest("hex");
    const suppliedKey = request.headers.get("idempotency-key") || "body";
    const idempotencyKey = `${routeId}:${clientIdentifier(request)}:${suppliedKey.slice(0, 160)}:${bodyHash}`;
    const cached = idempotencyEntries.get(idempotencyKey);
    if (cached && cached.expiresAt > now) {
      return toResponse((await cached.value) as StoredResult<TOutput>);
    }

    const retryAfter = takeRateLimitSlot(request, routeId);
    if (retryAfter !== null) {
      return jsonError("请求过于频繁，请稍后重试。", 429, true, {
        "retry-after": String(retryAfter),
      });
    }

    // The operation can be shared by idempotent callers, so its lifecycle must
    // not be tied to whichever browser request happened to arrive first.
    const sharedSignal = new AbortController().signal;
    const operation = (async (): Promise<StoredResult<TOutput>> => {
      try {
        const data = await runWithTimeout(sharedSignal, timeoutMs, (signal) =>
          handler(parsed.data, { signal }),
        );
        return { body: { data }, status: 200 };
      } catch (error) {
        return safeFailure(error);
      }
    })();

    const ttl = envInteger("AI_IDEMPOTENCY_TTL_MS", 15_000, 1_000, 300_000);
    idempotencyEntries.set(idempotencyKey, {
      expiresAt: now + ttl,
      value: operation as Promise<StoredResult<unknown>>,
    });

    const result = await operation;
    if (result.status < 200 || result.status >= 300) idempotencyEntries.delete(idempotencyKey);
    return toResponse(result);
  } catch (error) {
    return toResponse(safeFailure(error));
  }
}
