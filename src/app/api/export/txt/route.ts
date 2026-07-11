import { handleExportDownload } from "@/lib/export/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleExportDownload(request, "txt");
}
