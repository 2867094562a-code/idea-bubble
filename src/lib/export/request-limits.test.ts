// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildExportRequestBody, EXPORT_PAYLOAD_TOO_LARGE_MESSAGE } from "@/lib/export/client-request";
import { parseExportRequest } from "@/lib/export/request";
import { handleExportPreview } from "@/lib/export/route";
import { MAX_FUNCTION_PAYLOAD_BYTES } from "@/lib/payload-limits";
import { fixtureProject } from "@/test/fixtures";

function projectWithImage(dataUrl: string) {
  const project = fixtureProject();
  project.assets = [
    {
      id: "asset-hive",
      kind: "image",
      name: "蜂巢.png",
      mimeType: "image/png",
      size: 3,
      dataUrl,
      status: "ready",
      createdAt: "2026-07-11T08:02:00.000Z",
    },
  ];
  project.exportPresets[0].includeAssets = true;
  project.exportPresets[0].includedSections.push("assets");
  return project;
}

function request(body: string) {
  return new Request("http://localhost/api/export/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("线上导出 payload", () => {
  it("预览请求和响应都不携带素材 data URL", async () => {
    const marker = "UNIQUE_INLINE_IMAGE_PAYLOAD";
    const project = projectWithImage(`data:image/png;base64,${marker}`);
    const preset = project.exportPresets[0];
    const previewBody = buildExportRequestBody({
      project,
      preset,
      exportedAt: "2026-07-11T09:00:00.000Z",
      includeAssetData: false,
    });

    expect(previewBody).not.toContain(marker);
    expect(JSON.parse(previewBody).project.assets[0].dataUrl).toBe("");

    const directBody = buildExportRequestBody({
      project,
      preset,
      exportedAt: "2026-07-11T09:00:00.000Z",
      includeAssetData: true,
    });
    const response = await handleExportPreview(request(directBody));
    const responseText = await response.text();
    expect(response.status).toBe(200);
    expect(responseText).not.toContain(marker);
  });

  it("在 fetch 前拒绝超过 4.25 MB 的正式导出", () => {
    const project = projectWithImage(`data:image/png;base64,${"A".repeat(MAX_FUNCTION_PAYLOAD_BYTES)}`);
    const preset = project.exportPresets[0];

    expect(() =>
      buildExportRequestBody({
        project,
        preset,
        exportedAt: "2026-07-11T09:00:00.000Z",
        includeAssetData: true,
      }),
    ).toThrow(EXPORT_PAYLOAD_TOO_LARGE_MESSAGE);
  });

  it("服务端对绕过前端的超限请求返回 413", async () => {
    const oversized = `{"padding":"${"A".repeat(MAX_FUNCTION_PAYLOAD_BYTES)}"}`;

    await expect(parseExportRequest(request(oversized))).rejects.toMatchObject({
      status: 413,
      message: "导出请求过大，请减少素材数量。",
    });
  });
});
