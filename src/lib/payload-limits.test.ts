import { describe, expect, it } from "vitest";

import { validateMediaFile } from "@/lib/media/validation";
import {
  MAX_ANALYZABLE_IMAGE_BYTES,
  MAX_FUNCTION_PAYLOAD_BYTES,
  MAX_INLINE_DATA_URL_CHARS,
  utf8ByteLength,
} from "@/lib/payload-limits";
import { analyzeAssetRequestSchema } from "@/lib/schemas";

describe("Function payload 限制", () => {
  it("允许最大 3 MiB 静态图片并在前端拒绝更大的图片", () => {
    expect(
      validateMediaFile({ name: "蜂巢.png", size: MAX_ANALYZABLE_IMAGE_BYTES, type: "image/png" }, "image"),
    ).toEqual({ ok: true, kind: "image" });

    expect(
      validateMediaFile(
        { name: "蜂巢.png", size: MAX_ANALYZABLE_IMAGE_BYTES + 1, type: "image/png" },
        "image",
      ),
    ).toMatchObject({ ok: false });
  });

  it("校验 3 MiB 图片的 base64 膨胀边界", () => {
    const prefix = "data:image/png;base64,";
    const dataUrl = `${prefix}${"A".repeat(MAX_INLINE_DATA_URL_CHARS - prefix.length)}`;
    const input = {
      id: "asset-hive",
      name: "蜂巢.png",
      mimeType: "image/png",
      size: MAX_ANALYZABLE_IMAGE_BYTES,
      dataUrl,
      ai: { provider: "mock" as const },
    };

    expect(analyzeAssetRequestSchema.safeParse(input).success).toBe(true);
    expect(utf8ByteLength(JSON.stringify(input))).toBeLessThanOrEqual(MAX_FUNCTION_PAYLOAD_BYTES);
    expect(
      analyzeAssetRequestSchema.safeParse({ ...input, size: MAX_ANALYZABLE_IMAGE_BYTES + 1 }).success,
    ).toBe(false);
    expect(analyzeAssetRequestSchema.safeParse({ ...input, dataUrl: `${dataUrl}A` }).success).toBe(false);
  });

  it("按 UTF-8 字节而不是 JavaScript 字符数计算请求大小", () => {
    expect(utf8ByteLength("蜂巢")).toBe(6);
    expect(utf8ByteLength("hive")).toBe(4);
  });
});
