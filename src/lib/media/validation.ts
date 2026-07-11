import type { AssetKind } from "@/lib/domain";
import { MAX_ANALYZABLE_IMAGE_BYTES } from "@/lib/payload-limits";

export const MAX_IMAGE_BYTES = MAX_ANALYZABLE_IMAGE_BYTES;
export const MAX_GIF_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const GIF_MIME_TYPES = ["image/gif"] as const;
export const VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"] as const;

export const IMAGE_ACCEPT = IMAGE_MIME_TYPES.join(",");
export const GIF_ACCEPT = GIF_MIME_TYPES.join(",");
export const VIDEO_ACCEPT = VIDEO_MIME_TYPES.join(",");

export type MediaValidationResult = { ok: true; kind: AssetKind } | { ok: false; message: string };

const IMAGE_TYPES = new Set<string>(IMAGE_MIME_TYPES);
const GIF_TYPES = new Set<string>(GIF_MIME_TYPES);
const VIDEO_TYPES = new Set<string>(VIDEO_MIME_TYPES);

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function inferAssetKind(mimeType: string): AssetKind | undefined {
  const normalized = mimeType.trim().toLocaleLowerCase();
  if (GIF_TYPES.has(normalized)) return "gif";
  if (IMAGE_TYPES.has(normalized)) return "image";
  if (VIDEO_TYPES.has(normalized)) return "video";
  return undefined;
}

function maxBytesFor(kind: AssetKind): number {
  if (kind === "video") return MAX_VIDEO_BYTES;
  if (kind === "gif") return MAX_GIF_BYTES;
  return MAX_IMAGE_BYTES;
}

export function validateMediaFile(
  file: Pick<File, "name" | "size" | "type">,
  expectedKind?: AssetKind,
): MediaValidationResult {
  if (file.size <= 0) {
    return { ok: false, message: "文件为空或已经损坏，请选择其他文件。" };
  }

  const kind = inferAssetKind(file.type);
  if (!kind) {
    return {
      ok: false,
      message: "不支持此文件类型。图片支持 JPG、PNG、WebP、AVIF，视频支持 MP4、WebM、MOV，GIF 请单独上传。",
    };
  }

  if (expectedKind && kind !== expectedKind) {
    const expectedLabel = expectedKind === "image" ? "图片" : expectedKind === "video" ? "视频" : "GIF";
    return { ok: false, message: `这里仅接受${expectedLabel}文件。` };
  }

  const maxBytes = maxBytesFor(kind);
  if (file.size > maxBytes) {
    return {
      ok: false,
      message: `${kind === "video" ? "视频" : kind === "gif" ? "GIF" : "图片"}不能超过 ${formatFileSize(maxBytes)}。`,
    };
  }

  return { ok: true, kind };
}
