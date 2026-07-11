import { analyzeMediaAsset } from "@/lib/ai/media";
import { MAX_FUNCTION_PAYLOAD_BYTES } from "@/lib/payload-limits";
import { analyzeAssetRequestSchema } from "@/lib/schemas";
import { handleJsonPost } from "@/lib/server/route-handler";

export const runtime = "nodejs";

const analyzeMediaRequestSchema = analyzeAssetRequestSchema.refine(
  (value) => value.mimeType.startsWith("video/") || value.mimeType === "image/gif",
  {
    path: ["mimeType"],
    message: "媒体分析接口仅接受视频或 GIF。",
  },
);

export async function POST(request: Request): Promise<Response> {
  return handleJsonPost({
    request,
    routeId: "ai-analyze-media",
    schema: analyzeMediaRequestSchema,
    maxBodyBytes: MAX_FUNCTION_PAYLOAD_BYTES,
    handler: (input, { signal }) => analyzeMediaAsset(input, signal),
  });
}
