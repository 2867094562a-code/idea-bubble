import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ApiError, parseApiData, postJson } from "@/lib/api-client";

describe("浏览器 API 客户端", () => {
  afterEach(() => vi.restoreAllMocks());

  it("把断网转换成中文可重试错误", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(postJson("/api/test", {})).rejects.toMatchObject({
      message: "网络连接中断，请检查网络后重试。",
      retryable: true,
    });
  });

  it("拒绝成功响应中的畸形数据", () => {
    expect(() =>
      parseApiData(z.object({ ideas: z.array(z.string()).length(10) }), { ideas: ["不足"] }),
    ).toThrow(ApiError);
  });
});
