import { z } from "zod";

import { prepareAIRequest } from "@/lib/client-ai-config";
import type { AIProviderConfig, Asset } from "@/lib/domain";
import { expansionResultSchema, type ExpansionResult } from "@/lib/schemas";

const directResponseSchema = expansionResultSchema.extend({
  analysis: z.string().trim().max(2_000).optional(),
});

export interface ImageAnalysisResult {
  analysis?: string;
  expansion: ExpansionResult;
}

export async function analyzeImageAsset(
  asset: Asset,
  config: AIProviderConfig,
  signal?: AbortSignal,
): Promise<ImageAnalysisResult> {
  if (asset.kind !== "image") {
    throw new Error("只有静态图片可以提交视觉分析。视频和 GIF 尚未实现语义理解。");
  }

  const { ai, apiKey } = prepareAIRequest(config, "vision");
  const { analyzeImageAsset: analyzeImageWithAI } = await import("@/lib/ai/service");
  const payload = await analyzeImageWithAI(
    {
      id: asset.id,
      name: asset.name,
      mimeType: asset.mimeType,
      size: asset.size,
      dataUrl: asset.dataUrl,
      ai,
    },
    signal,
    apiKey,
  );

  const parsed = directResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("图片分析结果格式不完整，请重试。", {
      cause: parsed.error,
    });
  }

  const { analysis, ...expansion } = parsed.data;
  return { analysis, expansion };
}
