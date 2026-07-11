import { summarizeCollectedIdeas } from "@/lib/ai/service";
import { summarizeRequestSchema } from "@/lib/schemas";
import { handleJsonPost } from "@/lib/server/route-handler";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return handleJsonPost({
    request,
    routeId: "ai-summarize",
    schema: summarizeRequestSchema,
    handler: (input, { signal }) => summarizeCollectedIdeas(input, signal),
  });
}
