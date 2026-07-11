import { expandInspiration } from "@/lib/ai/service";
import { expandRequestSchema } from "@/lib/schemas";
import { handleJsonPost } from "@/lib/server/route-handler";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return handleJsonPost({
    request,
    routeId: "ai-expand",
    schema: expandRequestSchema,
    handler: (input, { signal }) => expandInspiration(input, signal),
  });
}
