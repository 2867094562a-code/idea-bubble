import type { ExportDocument, ExportRendererFormat } from "./types";

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const KNOWN_EXTENSIONS = /\.(?:docx|pdf|txt|md|markdown|json)$/i;

function formatFileDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "export";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/** Removes control characters, path separators, and Windows-invalid names. */
export function sanitizeFileName(value: string, fallback = "idea-bubble-export"): string {
  let result = value
    .normalize("NFKC")
    .replace(KNOWN_EXTENSIONS, "")
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 120)
    .replace(/[. ]+$/g, "");

  if (!result) result = fallback;
  if (WINDOWS_RESERVED.test(result)) result = `_${result}`;
  return result;
}

export function buildExportFileName(
  document: ExportDocument,
  format: ExportRendererFormat,
  requestedName?: string,
): string {
  const version = document.metadata.versionName || "当前版本";
  const fallback = `${document.metadata.projectName}_项目计划_${version}_${formatFileDate(document.metadata.exportedAt)}`;
  const base = sanitizeFileName(requestedName?.trim() || fallback);
  const extension = format === "markdown" ? "md" : format;
  return `${base}.${extension}`;
}

export function contentDisposition(fileName: string): string {
  const ascii =
    fileName
      .normalize("NFKD")
      .replace(/[^\x20-\x7e]/g, "_")
      .replace(/["\\]/g, "_")
      .replace(/\s+/g, " ")
      .slice(0, 150) || "download";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
