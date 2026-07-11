// @vitest-environment node

import { describe, expect, it } from "vitest";
import mammoth from "mammoth";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { buildExportDocument } from "@/lib/export/build-export-document";
import { renderDocx } from "@/lib/export/docx";
import { sanitizeFileName } from "@/lib/export/filename";
import { renderPdf } from "@/lib/export/pdf";
import { renderTxt, renderTxtText } from "@/lib/export/txt";
import { fixtureProject } from "@/test/fixtures";

describe("统一文档导出", () => {
  it("buildExportDocument 不修改项目并过滤未选择/空章节", () => {
    const project = fixtureProject();
    const before = structuredClone(project);
    const preset = project.exportPresets[0];
    const document = buildExportDocument(project, preset, "2026-07-11T09:00:00.000Z");
    expect(project).toEqual(before);
    expect(document.sections.map((section) => section.id)).toEqual([
      "projectInfo",
      "collectedIdeas",
      "concept",
      "plan",
      "execution",
      "risks",
      "version",
      "exportedAt",
    ]);
    expect(document.sections.some((section) => section.id === "imagePrompt")).toBe(false);
    expect(JSON.stringify(document)).not.toContain("sourceNodeIds");
  });

  it("清理非法文件名和 Windows 保留名", () => {
    expect(sanitizeFileName('蜂巢:/计划*?"')).toBe("蜂巢 计划");
    expect(sanitizeFileName("CON")).toBe("_CON");
  });

  it("TXT 使用 UTF-8 BOM、中文正常且无内部 ID/null", () => {
    const project = fixtureProject();
    const document = buildExportDocument(project, project.exportPresets[0]);
    const bytes = renderTxt(document);
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("蜂巢通勤概念");
    expect(text).toContain("创意总结");
    expect(text).toContain("完整项目计划");
    expect(text).not.toMatch(/undefined|null|sourceNodeIds|idea-1/);
    expect(renderTxtText(document)).not.toContain("<div>");
  });

  it("生成可解析的真实 DOCX，包含中文关键章节", async () => {
    const project = fixtureProject();
    const document = buildExportDocument(project, project.exportPresets[0]);
    const bytes = await renderDocx(document);
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b]);
    expect(bytes.byteLength).toBeLessThan(5 * 1024 * 1024);
    const extracted = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    expect(extracted.value).toContain("蜂巢通勤概念");
    expect(extracted.value).toContain("创意总结");
    expect(extracted.value).toContain("完整项目计划");
  }, 45_000);

  it("生成可解析的真实 PDF，保留中文和关键章节", async () => {
    const project = fixtureProject();
    const document = buildExportDocument(project, project.exportPresets[0]);
    const bytes = await renderPdf(document);
    expect(Buffer.from(bytes.slice(0, 5)).toString("ascii")).toBe("%PDF-");
    const pdf = await getDocument({ data: bytes, stopAtErrors: true }).promise;
    expect(pdf.numPages).toBeGreaterThan(0);
    let text = "";
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      text += content.items.map((item) => ("str" in item ? item.str : "")).join("");
    }
    expect(text).toContain("蜂巢通勤概念");
    expect(text).toContain("创意总结");
    expect(text).toContain("完整项目计划");
  }, 45_000);
});
