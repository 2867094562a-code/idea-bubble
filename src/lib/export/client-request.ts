import type { ExportPreset, Project } from "@/lib/domain";
import { MAX_FUNCTION_PAYLOAD_BYTES, utf8ByteLength } from "@/lib/payload-limits";

export const EXPORT_PAYLOAD_TOO_LARGE_MESSAGE =
  "导出内容超过线上 4.25 MB 限制，请关闭“包含素材图片”、减少素材或精简项目内容后重试。";

interface ExportRequestBodyOptions {
  project: Project;
  preset: ExportPreset;
  fileName?: string;
  exportedAt: string;
  includeAssetData: boolean;
}

export function exportProjectSnapshot(
  project: Project,
  preset: ExportPreset,
  includeAssetData: boolean,
): Project {
  const snapshot = structuredClone(project);
  snapshot.assets = snapshot.assets.map((asset) => ({
    ...asset,
    dataUrl: includeAssetData && preset.includeAssets && asset.kind !== "video" ? asset.dataUrl : "",
  }));
  return snapshot;
}

export function buildExportRequestBody(options: ExportRequestBodyOptions): string {
  const body = JSON.stringify({
    project: exportProjectSnapshot(options.project, options.preset, options.includeAssetData),
    preset: options.preset,
    fileName: options.fileName || undefined,
    exportedAt: options.exportedAt,
  });

  if (utf8ByteLength(body) > MAX_FUNCTION_PAYLOAD_BYTES) {
    throw new Error(EXPORT_PAYLOAD_TOO_LARGE_MESSAGE);
  }

  return body;
}
