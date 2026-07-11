// @vitest-environment node

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { PublicApiError } from "@/lib/server/errors";
import { handleJsonPost } from "@/lib/server/route-handler";

const schema = z.object({ value: z.string() });

function request(signal?: AbortSignal) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ value: "same" }),
    signal,
  });
}

describe("API 幂等与中断", () => {
  it("首个浏览器中断不会取消共享的同体请求", async () => {
    const controller = new AbortController();
    let calls = 0;
    const routeId = `abort-share-${crypto.randomUUID()}`;
    const run = (input: Request) =>
      handleJsonPost({
        request: input,
        routeId,
        schema,
        handler: async () => {
          calls += 1;
          await new Promise((resolve) => setTimeout(resolve, 40));
          return { ok: true };
        },
      });

    const first = run(request(controller.signal));
    await new Promise((resolve) => setTimeout(resolve, 8));
    controller.abort();
    const second = run(request());
    const responses = await Promise.all([first, second]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(calls).toBe(1);
  });

  it("非 2xx 结果不会污染下一次重试", async () => {
    let calls = 0;
    const routeId = `retry-${crypto.randomUUID()}`;
    const run = () =>
      handleJsonPost({
        request: request(),
        routeId,
        schema,
        handler: async () => {
          calls += 1;
          if (calls === 1) throw new PublicApiError("请求已取消。", 408, true);
          return { ok: true };
        },
      });

    expect((await run()).status).toBe(408);
    expect((await run()).status).toBe(200);
    expect(calls).toBe(2);
  });
});
