import { afterEach, describe, expect, it, vi } from "vitest";

import { expandInspiration } from "@/lib/ai/service";

const SENTINEL_KEY = "sentinel-browser-only-key";

function ideas() {
  return Array.from({ length: 10 }, (_, index) => ({
    word: `直连灵感${index}`,
    category: "结构",
    reason: `与蜂巢结构相关的直连灵感 ${index}`,
    visualHint: `六边形视觉 ${index}`,
    relevance: 0.8,
  }));
}

function chatCompletion() {
  return new Response(
    JSON.stringify({
      id: "chatcmpl-browser-byok",
      object: "chat.completion",
      created: 1,
      model: "user-model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({ source: "蜂巢", ideas: ideas() }),
          },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function request() {
  return {
    source: "蜂巢",
    existingWords: [],
    direction: "balanced" as const,
    ai: {
      provider: "openai-compatible" as const,
      model: "user-model",
      baseURL: "https://provider.example/v1",
    },
  };
}

function mimoRequest() {
  return {
    ...request(),
    ai: {
      provider: "mimo" as const,
      model: "mimo-v2.5-pro",
    },
  };
}

describe("浏览器直连 BYOK", () => {
  afterEach(() => vi.restoreAllMocks());

  it("只向用户选择的 Provider 发送当前 Key 和模型", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(chatCompletion());

    const result = await expandInspiration(request(), undefined, SENTINEL_KEY);

    expect(result.ideas).toHaveLength(10);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://provider.example/v1/chat/completions");
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${SENTINEL_KEY}`);
    expect(headers.has("cookie")).toBe(false);
    expect(init).toMatchObject({
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      redirect: "error",
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: "user-model" });
    expect(String(url)).not.toContain(SENTINEL_KEY);
    expect(String(init?.body)).not.toContain(SENTINEL_KEY);
  });

  it("MiMo uses its documented endpoint and api-key authentication", async () => {
    const completion = chatCompletion();
    const payload = await completion.json();
    payload.choices[0].message.content = `<think>internal reasoning</think>\n\`\`\`json\n${JSON.stringify({ source: "蜂巢", ideas: ideas() })}\n\`\`\``;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await expandInspiration(mimoRequest(), undefined, SENTINEL_KEY);

    expect(result.ideas).toHaveLength(10);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.xiaomimimo.com/v1/chat/completions");
    const headers = new Headers(init?.headers);
    expect(headers.get("api-key")).toBe(SENTINEL_KEY);
    expect(headers.has("authorization")).toBe(false);
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ model: "mimo-v2.5-pro" });
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(String(init?.body)).not.toContain(SENTINEL_KEY);
  });

  it("MiMo exposes a safe actionable status without leaking upstream details", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: `invalid ${SENTINEL_KEY}` } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(expandInspiration(mimoRequest(), undefined, SENTINEL_KEY)).rejects.toMatchObject({
      message: "MiMo 未接受该 API Key，请确认 Key 类型、有效期和完整性。",
      status: 401,
    });
  });

  it("上游错误即使包含 Key 也只返回脱敏文案", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error(`network failed ${SENTINEL_KEY}`));

    await expect(expandInspiration(request(), undefined, SENTINEL_KEY)).rejects.toMatchObject({
      message: expect.not.stringContaining(SENTINEL_KEY),
    });
  });

  it("取消错误不会把上游错误对象中的认证信息带回界面", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new DOMException(`aborted ${SENTINEL_KEY}`, "AbortError"),
    );

    await expect(expandInspiration(request(), undefined, SENTINEL_KEY)).rejects.toMatchObject({
      message: "AI 请求已取消。",
    });
  });
});
