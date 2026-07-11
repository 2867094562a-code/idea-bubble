import type { z } from "zod";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": crypto.randomUUID(),
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      throw new ApiError("请求已取消。", 408, true);
    }
    throw new ApiError("网络连接中断，请检查网络后重试。", 0, true);
  }
  const payload = (await response.json().catch(() => null)) as {
    data?: T;
    error?: string;
    retryable?: boolean;
  } | null;
  if (!response.ok || !payload?.data) {
    throw new ApiError(
      payload?.error || "服务暂时不可用，请稍后重试。",
      response.status,
      Boolean(payload?.retryable),
    );
  }
  return payload.data;
}

export function parseApiData<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError("AI 返回的数据格式不完整，请重试。", 502, true);
  }
  return parsed.data;
}
