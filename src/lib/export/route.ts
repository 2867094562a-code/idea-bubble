import type { ExportFormat } from "@/lib/domain";
import { buildExportDocument } from "@/lib/export/build-export-document";
import { renderDocx } from "@/lib/export/docx";
import { buildExportFileName, contentDisposition } from "@/lib/export/filename";
import { renderJson } from "@/lib/export/json";
import { renderMarkdown } from "@/lib/export/markdown";
import { renderPdf } from "@/lib/export/pdf";
import { parseExportRequest } from "@/lib/export/request";
import { renderTxt } from "@/lib/export/txt";
import { MAX_FUNCTION_PAYLOAD_BYTES, utf8ByteLength } from "@/lib/payload-limits";
import { PublicApiError } from "@/lib/server/errors";

const mimeTypes: Record<ExportFormat, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  txt: "text/plain; charset=utf-8",
  markdown: "text/markdown; charset=utf-8",
  json: "application/json; charset=utf-8",
};

const renderers: Record<
  ExportFormat,
  (document: ReturnType<typeof buildExportDocument>) => Promise<Uint8Array> | Uint8Array
> = {
  docx: renderDocx,
  pdf: renderPdf,
  txt: renderTxt,
  markdown: renderMarkdown,
  json: renderJson,
};

function safeError(error: unknown): Response {
  const publicError =
    error instanceof PublicApiError
      ? error
      : new PublicApiError("文档生成失败，请检查内容和素材后重试。", 500, true);
  return Response.json(
    { error: publicError.message, retryable: publicError.retryable },
    {
      status: publicError.status,
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    },
  );
}

export async function handleExportPreview(request: Request): Promise<Response> {
  try {
    const input = await parseExportRequest(request);
    const previewProject = {
      ...input.project,
      assets: input.project.assets.map((asset) => ({ ...asset, dataUrl: "" })),
    };
    const document = buildExportDocument(previewProject, input.preset, input.exportedAt);
    const fileNames = Object.fromEntries(
      input.preset.formats.map((format) => [format, buildExportFileName(document, format, input.fileName)]),
    );
    const body = JSON.stringify({ data: document, fileNames });
    if (utf8ByteLength(body) > MAX_FUNCTION_PAYLOAD_BYTES) {
      throw new PublicApiError("导出预览内容过大，请减少项目内容后重试。", 413, false);
    }
    return new Response(body, {
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return safeError(error);
  }
}

export async function handleExportDownload(request: Request, format: ExportFormat): Promise<Response> {
  try {
    const input = await parseExportRequest(request);
    const document = buildExportDocument(input.project, input.preset, input.exportedAt);
    const bytes = await renderers[format](document);
    if (!bytes.byteLength) throw new PublicApiError("生成的文件为空，请重试。", 500, true);
    if (bytes.byteLength > MAX_FUNCTION_PAYLOAD_BYTES) {
      throw new PublicApiError(
        "导出文件超过线上 4.25 MB 限制，请关闭“包含素材图片”或减少素材后重试。",
        413,
        false,
      );
    }
    const fileName = buildExportFileName(document, format, input.fileName);
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "content-type": mimeTypes[format],
        "content-length": String(bytes.byteLength),
        "content-disposition": contentDisposition(fileName),
        "cache-control": "private, no-store, max-age=0",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return safeError(error);
  }
}
