import { z } from "zod";

import { postJson } from "@/lib/api-client";
import type { AIProviderId, Asset } from "@/lib/domain";
import { expansionResultSchema, type ExpansionResult } from "@/lib/schemas";

const directResponseSchema = expansionResultSchema.extend({
  analysis: z.string().trim().max(2_000).optional(),
});

const nestedResponseSchema = z.object({
  analysis: z.string().trim().max(2_000).optional(),
  expansion: expansionResultSchema,
});

const analyzeImageResponseSchema = z.union([directResponseSchema, nestedResponseSchema]);

export interface ImageAnalysisResult {
  analysis?: string;
  expansion: ExpansionResult;
}

export async function analyzeImageAsset(
  asset: Asset,
  provider: AIProviderId,
  signal?: AbortSignal,
): Promise<ImageAnalysisResult> {
  if (asset.kind !== "image") {
    throw new Error("只有静态图片可以提交视觉分析。视频和 GIF 尚未实现语义理解。");
  }

  const payload = await postJson<unknown>(
    "/api/ai/analyze-image",
    {
      id: asset.id,
      name: asset.name,
      mimeType: asset.mimeType,
      size: asset.size,
      dataUrl: asset.dataUrl,
      provider,
    },
    signal,
  );

  const parsed = analyzeImageResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("图片分析结果格式不完整，请重试。", {
      cause: parsed.error,
    });
  }

  if ("expansion" in parsed.data) {
    return parsed.data;
  }

  const { analysis, ...expansion } = parsed.data;
  return { analysis, expansion };
}
