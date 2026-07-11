import { z } from "zod";
import type { ExportFormat, ExportPreset, Project } from "@/lib/domain";
import {
  conceptSummarySchema,
  imagePromptSchema,
  inspirationIdeaSchema,
  projectInfoSchema,
  projectPlanSchema,
} from "@/lib/schemas";
import { MAX_FUNCTION_PAYLOAD_BYTES, MAX_INLINE_DATA_URL_CHARS } from "@/lib/payload-limits";
import { PublicApiError } from "@/lib/server/errors";

export const exportFormatSchema = z.enum(["docx", "pdf", "txt", "markdown", "json"]);
const exportSectionSchema = z.enum([
  "cover",
  "projectInfo",
  "originalInput",
  "assets",
  "allIdeas",
  "relationships",
  "collectedIdeas",
  "concept",
  "plan",
  "execution",
  "risks",
  "imagePrompt",
  "version",
  "exportedAt",
]);

export const exportPresetSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  formats: z.array(exportFormatSchema).min(1).max(5),
  includedSections: z.array(exportSectionSchema).max(20),
  layout: z.enum(["minimal", "business", "creative", "school", "plain"]),
  orientation: z.enum(["portrait", "landscape"]),
  includeCover: z.boolean(),
  includeTableOfContents: z.boolean(),
  includeHeader: z.boolean(),
  includeFooter: z.boolean(),
  includePageNumbers: z.boolean(),
  includeAssets: z.boolean(),
  includeSourceIdeas: z.boolean(),
  includeImagePrompt: z.boolean(),
  customRequirements: z.string().max(4_000),
  coverTitle: z.string().max(160).optional(),
  subtitle: z.string().max(240).optional(),
  author: z.string().max(100).optional(),
  organization: z.string().max(160).optional(),
  versionName: z.string().max(80).optional(),
  fileName: z.string().max(160).optional(),
});

const assetSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["image", "video", "gif"]),
  name: z.string().min(1).max(240),
  mimeType: z.string().min(1).max(100),
  size: z
    .number()
    .nonnegative()
    .max(25 * 1024 * 1024),
  dataUrl: z.string().max(30 * 1024 * 1024),
  status: z.enum(["ready", "analyzing", "analyzed", "unsupported", "error"]),
  analysis: z.string().max(2_000).optional(),
  createdAt: z.string().datetime(),
});

const nodeSchema = inspirationIdeaSchema.extend({
  id: z.string().min(1),
  parentId: z.string().optional(),
  sourceAssetId: z.string().optional(),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }),
  depth: z.number().int().min(0).max(40),
  collected: z.boolean(),
  locked: z.boolean(),
  collapsed: z.boolean(),
  createdAt: z.string().datetime(),
});

const projectSchema = z
  .object({
    id: z.string().min(1).max(120),
    info: projectInfoSchema,
    originalInputs: z.array(z.string().max(500)).max(200),
    assets: z.array(assetSchema).max(30),
    nodes: z.array(nodeSchema).max(200),
    edges: z.array(z.object({ id: z.string(), source: z.string(), target: z.string() })).max(400),
    currentConcept: conceptSummarySchema.optional(),
    conceptVersions: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          data: conceptSummarySchema,
          createdAt: z.string().datetime(),
        }),
      )
      .max(100),
    currentPlan: projectPlanSchema.optional(),
    planVersions: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          data: projectPlanSchema,
          createdAt: z.string().datetime(),
          isFinal: z.boolean(),
        }),
      )
      .max(100),
    imagePromptVersions: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          data: imagePromptSchema,
          createdAt: z.string().datetime(),
        }),
      )
      .max(100),
    exportPresets: z.array(exportPresetSchema).max(50),
    exportJobs: z.array(z.unknown()).max(100),
    aiRequestLogs: z.array(z.unknown()).max(500),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((project, context) => {
    const imageAssets = project.assets.filter((asset) => asset.kind === "image" || asset.kind === "gif");
    if (imageAssets.length > 20) {
      context.addIssue({ code: "custom", path: ["assets"], message: "单次导出最多包含 20 个图片素材" });
    }
    const totalDataLength = imageAssets.reduce((sum, asset) => sum + asset.dataUrl.length, 0);
    if (totalDataLength > MAX_INLINE_DATA_URL_CHARS) {
      context.addIssue({ code: "custom", path: ["assets"], message: "导出图片总大小过大，请减少素材" });
    }
  });

export const exportRequestSchema = z.object({
  project: projectSchema,
  preset: exportPresetSchema,
  fileName: z.string().max(160).optional(),
  exportedAt: z.string().datetime().optional(),
});

export interface ExportRequestInput {
  project: Project;
  preset: ExportPreset;
  fileName?: string;
  exportedAt: string;
}

function validationMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue?.path.length ? `${issue.path.join(".")}：` : "";
  return `导出请求无效：${path}${issue?.message || "参数错误"}`;
}

export async function parseExportRequest(request: Request): Promise<ExportRequestInput> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new PublicApiError("导出请求必须使用 application/json。", 415, false);
  }
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_FUNCTION_PAYLOAD_BYTES) {
    throw new PublicApiError("导出请求过大，请减少素材数量。", 413, false);
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_FUNCTION_PAYLOAD_BYTES) {
    throw new PublicApiError("导出请求过大，请减少素材数量。", 413, false);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw) as unknown;
  } catch {
    throw new PublicApiError("导出请求 JSON 格式无效。", 400, false);
  }
  const parsed = exportRequestSchema.safeParse(json);
  if (!parsed.success) {
    throw new PublicApiError(validationMessage(parsed.error), 400, false);
  }
  return {
    project: parsed.data.project as Project,
    preset: parsed.data.preset as ExportPreset,
    fileName: parsed.data.fileName,
    exportedAt: parsed.data.exportedAt || new Date().toISOString(),
  };
}

export function isExportFormat(value: string): value is ExportFormat {
  return exportFormatSchema.safeParse(value).success;
}
