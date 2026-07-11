import { generateProjectPlan } from "@/lib/ai/service";
import { planRequestSchema } from "@/lib/schemas";
import { handleJsonPost } from "@/lib/server/route-handler";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return handleJsonPost({
    request,
    routeId: "ai-plan",
    schema: planRequestSchema,
    handler: (input, { signal }) => generateProjectPlan(input, signal),
  });
}
