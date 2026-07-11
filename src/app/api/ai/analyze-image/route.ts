import { analyzeImageAsset } from "@/lib/ai/service";
import { MAX_FUNCTION_PAYLOAD_BYTES } from "@/lib/payload-limits";
import { analyzeAssetRequestSchema } from "@/lib/schemas";
import { handleJsonPost } from "@/lib/server/route-handler";

export const runtime = "nodejs";

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

const analyzeImageRequestSchema = analyzeAssetRequestSchema.superRefine((value, context) => {
  const mimeType = value.mimeType.toLowerCase();
  if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
    context.addIssue({
      code: "custom",
      path: ["mimeType"],
      message: "仅支持 JPEG、PNG、WebP 或 AVIF；动态 GIF 需要抽帧后分析。",
    });
  }
  if (!value.dataUrl.toLowerCase().startsWith(`data:${mimeType};base64,`)) {
    context.addIssue({
      code: "custom",
      path: ["dataUrl"],
      message: "图片必须是与 mimeType 一致的 Base64 data URL。",
    });
  }
});

export async function POST(request: Request): Promise<Response> {
  return handleJsonPost({
    request,
    routeId: "ai-analyze-image",
    schema: analyzeImageRequestSchema,
    maxBodyBytes: MAX_FUNCTION_PAYLOAD_BYTES,
    timeoutMs: 60_000,
    handler: (input, { signal }) => analyzeImageAsset(input, signal),
  });
}
