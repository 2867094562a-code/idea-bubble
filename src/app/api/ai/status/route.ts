import { getProviderStatus } from "@/lib/ai/providers";
import { jsonSuccess } from "@/lib/server/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return jsonSuccess(getProviderStatus());
}
