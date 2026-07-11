import type { z } from "zod";

import type { analyzeAssetRequestSchema } from "@/lib/schemas";
import { PublicApiError } from "@/lib/server/errors";

type AnalyzeAssetInput = z.infer<typeof analyzeAssetRequestSchema>;

export interface MediaAnalyzer {
  analyze(input: AnalyzeAssetInput, signal?: AbortSignal): Promise<never>;
}

export class UnsupportedMediaAnalyzer implements MediaAnalyzer {
  async analyze(input: AnalyzeAssetInput, signal?: AbortSignal): Promise<never> {
    void input;
    void signal;
    throw new PublicApiError(
      "当前版本仅提供视频与动态 GIF 的 MediaAnalyzer 接口抽象，尚未实现抽帧和真实媒体理解。",
      501,
      false,
    );
  }
}

const mediaAnalyzer: MediaAnalyzer = new UnsupportedMediaAnalyzer();

export async function analyzeMediaAsset(input: AnalyzeAssetInput, signal?: AbortSignal): Promise<never> {
  return mediaAnalyzer.analyze(input, signal);
}
