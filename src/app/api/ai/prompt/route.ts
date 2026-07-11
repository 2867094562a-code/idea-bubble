import { generateImagePrompt } from "@/lib/ai/service";
import { promptRequestSchema } from "@/lib/schemas";
import { handleJsonPost } from "@/lib/server/route-handler";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return handleJsonPost({
    request,
    routeId: "ai-prompt",
    schema: promptRequestSchema,
    handler: (input, { signal }) => generateImagePrompt(input, signal),
  });
}
