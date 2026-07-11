import { readFile } from "node:fs/promises";

import { expect, test, type Download } from "@playwright/test";
import mammoth from "mammoth";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

test.describe("Idea Bubble 核心闭环", () => {
  test("从创建项目到三种真实文件导出并持久化", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "桌面端完整闭环只运行一次");

    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    await page.goto("/");
    await page.getByPlaceholder("例如：蜂巢城市通勤鞋").fill("蜂巢 E2E 项目");
    await page.getByRole("button", { name: "创建灵感空间" }).click();

    await page.getByPlaceholder("输入一个词、一句话，或一段简短说明……").fill("蜂巢");
    await page.getByRole("button", { name: "生成 10 个灵感气泡" }).click();
    await expect(page.locator(".bubble-surface")).toHaveCount(11, { timeout: 30_000 });

    for (let index = 1; index <= 5; index += 1) {
      await page.locator(".bubble-wrap").nth(index).click();
      await page.waitForTimeout(350);
    }
    await expect(page.getByRole("button", { name: "总结灵感" })).toBeEnabled();
    await page.getByRole("button", { name: "总结灵感" }).click();

    await expect(page.getByText("创意说明", { exact: true })).toBeVisible({ timeout: 30_000 });
    const conceptSummary = page.locator("main textarea").first();
    await conceptSummary.fill(
      "这是由 E2E 测试编辑并保存的蜂巢创意总结，用于验证内容在计划与导出之间保持一致。",
    );
    await page.getByRole("button", { name: "保存版本" }).click();
    await page.getByRole("button", { name: "生成项目计划" }).click();

    await expect(page.getByText("项目计划", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "保存版本" }).click();
    await page.getByRole("button", { name: "直接导出" }).click();
    const exportDialog = page.getByRole("dialog", { name: "导出项目" });
    await expect(exportDialog).toBeVisible();

    for (const section of ["项目基本信息", "执行步骤", "风险与验证", "版本信息", "导出时间"]) {
      await exportDialog.locator("label").filter({ hasText: section }).click();
    }
    await page
      .getByPlaceholder("例如：使用正式项目报告格式，将灵感关键词放入附录。")
      .fill("保持正式语气；仅包含封面、创意总结和完整项目计划。");
    await page.getByRole("tab", { name: "版式" }).click();

    await expect(page.getByRole("heading", { name: "创意总结", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { name: "完整项目计划", exact: true })).toBeVisible();

    const downloads: Download[] = [];
    page.on("download", (download) => downloads.push(download));
    await page.getByRole("button", { name: "生成并下载" }).click();
    await expect.poll(() => downloads.length, { timeout: 60_000 }).toBe(3);

    const docx = downloads.find((download) => download.suggestedFilename().endsWith(".docx"));
    const pdf = downloads.find((download) => download.suggestedFilename().endsWith(".pdf"));
    const txt = downloads.find((download) => download.suggestedFilename().endsWith(".txt"));
    expect(docx).toBeDefined();
    expect(pdf).toBeDefined();
    expect(txt).toBeDefined();

    const [docxPath, pdfPath, txtPath] = await Promise.all([docx!.path(), pdf!.path(), txt!.path()]);
    expect(docxPath).not.toBeNull();
    expect(pdfPath).not.toBeNull();
    expect(txtPath).not.toBeNull();

    const [docxBytes, pdfBytes, txtBytes] = await Promise.all([
      readFile(docxPath!),
      readFile(pdfPath!),
      readFile(txtPath!),
    ]);
    const extractedDocx = await mammoth.extractRawText({ buffer: docxBytes });
    expect(extractedDocx.value).toContain("蜂巢 E2E 项目");
    expect(extractedDocx.value).toContain("创意总结");
    expect(extractedDocx.value).toContain("完整项目计划");

    const parsedPdf = await getDocument({ data: new Uint8Array(pdfBytes), stopAtErrors: true }).promise;
    let pdfText = "";
    for (let pageNumber = 1; pageNumber <= parsedPdf.numPages; pageNumber += 1) {
      const pdfPage = await parsedPdf.getPage(pageNumber);
      const content = await pdfPage.getTextContent();
      pdfText += content.items.map((item) => ("str" in item ? item.str : "")).join("");
    }
    expect(pdfText).toContain("蜂巢 E2E 项目");
    expect(pdfText).toContain("创意总结");
    expect(pdfText).toContain("完整项目计划");

    expect(Array.from(txtBytes.subarray(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const txtText = txtBytes.toString("utf8");
    expect(txtText).toContain("蜂巢 E2E 项目");
    expect(txtText).toContain("创意总结");
    expect(txtText).toContain("完整项目计划");

    await page.getByRole("button", { name: "Close" }).click();
    await page.reload();
    await expect(page.getByText("蜂巢 E2E 项目", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("EDITABLE · TRACEABLE", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "01 发散", exact: true }).click();
    await expect(page.locator(".bubble-surface")).toHaveCount(11);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".bubble-surface").first()).toHaveCSS("animation-name", "none");
    expect(pageErrors).toEqual([]);
  });

  test("移动端可以创建、打开输入抽屉并生成气泡", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "移动端冒烟测试只运行一次");

    await page.goto("/");
    await page.getByPlaceholder("例如：蜂巢城市通勤鞋").fill("移动端蜂巢项目");
    await page.getByRole("button", { name: "创建灵感空间" }).click();
    await page.getByRole("button", { name: "打开灵感入口" }).click();
    const sourceSheet = page.getByRole("dialog", { name: "灵感入口" });
    await sourceSheet.getByPlaceholder("输入一个词、一句话，或一段简短说明……").fill("蜂巢");
    await sourceSheet.getByRole("button", { name: "生成 10 个灵感气泡" }).click();

    await expect(page.locator(".bubble-surface")).toHaveCount(11, { timeout: 30_000 });
    await expect(page.locator("#collection-dock")).toBeVisible();
    await expect(page.getByRole("button", { name: "打开详情面板" })).toBeVisible();
  });
});
