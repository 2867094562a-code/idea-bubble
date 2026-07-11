import type { Asset, AssetKind } from "@/lib/domain";

export interface MediaOperationOptions {
  signal?: AbortSignal;
}

export type MediaAnalysisOutcome =
  | {
      status: "analyzed";
      summary: string;
    }
  | {
      status: "unsupported";
      reason: string;
    };

export interface ExtractedFrame {
  id: string;
  dataUrl: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  timestampMs: number;
}

export type FrameExtractionOutcome =
  | {
      status: "ready";
      frames: ExtractedFrame[];
    }
  | {
      status: "unsupported";
      reason: string;
    };

/**
 * Boundary for future video and animated-GIF semantic analysis.
 * Implementations must report unsupported rather than fabricate a result.
 */
export interface MediaAnalyzer {
  analyze(asset: Asset, options?: MediaOperationOptions): Promise<MediaAnalysisOutcome>;
}

/** Boundary for a future browser, worker, or server-side key-frame extractor. */
export interface FrameExtractor {
  extractFrames(asset: Asset, options?: MediaOperationOptions): Promise<FrameExtractionOutcome>;
}

const UNSUPPORTED_REASONS: Record<Exclude<AssetKind, "image">, string> = {
  video: "当前版本仅保存和预览视频，尚未实现抽帧与视频语义理解。",
  gif: "当前版本仅保存和预览 GIF，尚未实现动态 GIF 拆帧与语义理解。",
};

export class UnsupportedMediaAnalyzer implements MediaAnalyzer {
  async analyze(asset: Asset, options?: MediaOperationOptions): Promise<MediaAnalysisOutcome> {
    if (options?.signal?.aborted) throw new DOMException("分析已取消", "AbortError");
    const reason =
      asset.kind === "image" ? "图片分析由独立的视觉模型接口处理。" : UNSUPPORTED_REASONS[asset.kind];

    return { status: "unsupported", reason };
  }
}

export class UnsupportedFrameExtractor implements FrameExtractor {
  async extractFrames(asset: Asset, options?: MediaOperationOptions): Promise<FrameExtractionOutcome> {
    if (options?.signal?.aborted) throw new DOMException("抽帧已取消", "AbortError");
    const reason = asset.kind === "gif" ? UNSUPPORTED_REASONS.gif : "当前版本尚未实现媒体关键帧提取。";

    return { status: "unsupported", reason };
  }
}

export const unsupportedMediaAnalyzer = new UnsupportedMediaAnalyzer();
export const unsupportedFrameExtractor = new UnsupportedFrameExtractor();
