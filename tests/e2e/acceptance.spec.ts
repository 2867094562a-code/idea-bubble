import { expect, test, type Page } from "@playwright/test";

async function createProject(page: Page, name: string) {
  await page.goto("/");
  await page.getByPlaceholder("例如：蜂巢城市通勤鞋").fill(name);
  await page.getByRole("button", { name: "创建灵感空间" }).click();
}

async function generateHoneycomb(page: Page) {
  const input = page.getByPlaceholder("输入一个词、一句话，或一段简短说明……").filter({ visible: true });
  await input.fill("蜂巢");
  await page.getByRole("button", { name: "生成 10 个灵感气泡" }).filter({ visible: true }).click();
  await expect(page.locator(".bubble-surface")).toHaveCount(11);
}

test.describe("验收回归", () => {
  test("首层逐个出现、五次飞入、取消重收和双击二层", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "桌面交互只运行一次");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await createProject(page, "蜂巢交互验收");
    await generateHoneycomb(page);

    const words = await page
      .locator(".bubble-surface")
      .evaluateAll((elements) =>
        elements.slice(1).map((element) => element.children[1]?.textContent?.trim() || ""),
      );
    expect(words).toHaveLength(10);
    expect(new Set(words).size).toBe(10);
    expect(words).toEqual(expect.arrayContaining(["六边晶格", "巢室模块", "蜂蜡半透", "仿生承重"]));

    const firstLayerDelays = await page
      .locator(".bubble-wrap")
      .evaluateAll((elements) =>
        elements.slice(1, 11).map((element) => getComputedStyle(element).animationDelay),
      );
    expect(firstLayerDelays).toEqual([
      "0s",
      "0.078s",
      "0.156s",
      "0.234s",
      "0.312s",
      "0.39s",
      "0.468s",
      "0.546s",
      "0.624s",
      "0.702s",
    ]);
    await expect(page.locator(".bubble-surface").nth(1)).toHaveCSS("animation-name", "bubble-float");
    await expect(page.locator(".bubble-surface").nth(1)).toHaveCSS("animation-duration", "4.2s");

    await page.evaluate(() => {
      const target = window as Window & {
        __flightRecords?: Array<{ id: string; word: string; animationName: string }>;
      };
      target.__flightRecords = [];
      new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (!(node instanceof HTMLElement) || !node.classList.contains("collection-flight")) continue;
            target.__flightRecords?.push({
              id: node.dataset.flightId || "",
              word: node.dataset.flightWord || "",
              animationName: getComputedStyle(node).animationName,
            });
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    });
    for (const [index, word] of words.slice(0, 5).entries()) {
      await page.locator(".bubble-wrap").filter({ hasText: word }).click();
      await expect(page.locator("#collection-dock button.group")).toHaveCount(index + 1);
    }
    await expect(page.locator("#collection-dock button.group")).toHaveCount(5);
    const flightRecords = await page.evaluate(
      () =>
        (
          window as Window & {
            __flightRecords?: Array<{ id: string; word: string; animationName: string }>;
          }
        ).__flightRecords || [],
    );
    expect(flightRecords).toHaveLength(5);
    expect(new Set(flightRecords.map((record) => record.id)).size).toBe(5);
    expect(flightRecords.map((record) => record.word)).toEqual(words.slice(0, 5));
    expect(flightRecords.every((record) => record.animationName === "collect-flight")).toBe(true);

    await page.getByRole("button", { name: words[2], exact: true }).click();
    await expect(page.locator("#collection-dock button.group")).toHaveCount(4);
    await page.locator(".bubble-wrap").filter({ hasText: words[2] }).click();
    await page.waitForTimeout(350);
    await expect(page.locator("#collection-dock button.group")).toHaveCount(5);
    await expect(page.getByRole("button", { name: words[2], exact: true })).toHaveCount(1);

    await page.locator(".bubble-wrap").filter({ hasText: words[5] }).dblclick();
    await expect(page.locator(".bubble-surface")).toHaveCount(21);
    await expect(page.locator("#collection-dock button.group")).toHaveCount(5);

    const secondLayerDelays = await page
      .locator(".bubble-wrap")
      .evaluateAll((elements) =>
        elements.slice(11, 21).map((element) => getComputedStyle(element).animationDelay),
      );
    expect(secondLayerDelays).toEqual(firstLayerDelays);
    await page.waitForTimeout(450);
    const bounds = await page.evaluate(() => {
      const flow = document.querySelector(".react-flow")!.getBoundingClientRect();
      return Array.from(document.querySelectorAll(".bubble-surface")).map((element) => {
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        return x >= flow.left && x <= flow.right && y >= flow.top && y <= flow.bottom;
      });
    });
    expect(bounds.every(Boolean)).toBe(true);
  });

  test("畸形响应和断网不会写坏项目，并允许重试", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "桌面容错只运行一次");
    await createProject(page, "蜂巢容错验收");

    await page.route("**/api/ai/expand", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { source: "蜂巢", ideas: [{ word: "不足" }] } }),
      });
    });
    await generateAttempt(page);
    await expect(page.locator("main [role=alert]")).toContainText("AI 返回的数据格式不完整，请重试。");
    await expect(page.locator(".bubble-surface")).toHaveCount(0);
    await page.unroute("**/api/ai/expand");

    await page.route("**/api/ai/expand", async (route) => route.abort("failed"));
    await generateAttempt(page);
    await expect(page.locator("main [role=alert]")).toContainText("网络连接中断，请检查网络后重试。");
    await expect(page.locator(".bubble-surface")).toHaveCount(0);
    await page.unroute("**/api/ai/expand");

    await generateHoneycomb(page);
    await expect(page.getByRole("button", { name: "Mock 演示" })).toBeVisible();
  });

  test("AI 请求互斥且旧请求不会污染新项目", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "桌面竞态只运行一次");
    await createProject(page, "旧项目");
    let requestCount = 0;
    await page.route("**/api/ai/expand", async (route) => {
      requestCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 650));
      await route.continue().catch(() => undefined);
    });

    const input = page.getByPlaceholder("输入一个词、一句话，或一段简短说明……").filter({ visible: true });
    await input.fill("蜂巢");
    const generate = page.getByRole("button", { name: "生成 10 个灵感气泡" }).filter({ visible: true });
    await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll("button")).find((element) =>
        element.textContent?.includes("生成 10 个灵感气泡"),
      );
      button?.click();
      button?.click();
    });
    await expect(generate).toBeDisabled();
    await page.getByRole("button", { name: "新建项目" }).click();
    await page.getByPlaceholder("例如：蜂巢城市通勤鞋").fill("新项目");
    await page.getByRole("button", { name: "创建灵感空间" }).click();
    await page.waitForTimeout(850);

    expect(requestCount).toBe(1);
    await expect(page.getByText("新项目", { exact: true }).first()).toBeVisible();
    await expect(page.locator(".bubble-surface")).toHaveCount(0);
  });

  test("移动工具栏不覆盖画布，且减少动态效果完整生效", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "移动布局只运行一次");
    await createProject(page, "移动布局验收");
    await page.getByRole("button", { name: "打开灵感入口" }).click();
    const sheet = page.getByRole("dialog", { name: "灵感入口" });
    await sheet.getByPlaceholder("输入一个词、一句话，或一段简短说明……").fill("蜂巢");
    await sheet.getByRole("button", { name: "生成 10 个灵感气泡" }).click();
    await expect(page.locator(".bubble-surface")).toHaveCount(11);

    const metrics = await page.evaluate(() => {
      const flow = document.querySelector(".idea-flow")!.getBoundingClientRect();
      const leftButton = document.querySelector('button[aria-label="打开灵感入口"]')!.getBoundingClientRect();
      const dock = document.querySelector("#collection-dock")!.getBoundingClientRect();
      return {
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
        toolbarAboveCanvas: leftButton.bottom <= flow.top,
        dockInsideViewport:
          dock.left >= 0 && dock.right <= window.innerWidth && dock.bottom <= window.innerHeight,
      };
    });
    expect(metrics).toEqual({
      horizontalOverflow: false,
      toolbarAboveCanvas: true,
      dockInsideViewport: true,
    });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".bubble-wrap").first()).toHaveCSS("animation-name", "none");
    await expect(page.locator(".bubble-surface").first()).toHaveCSS("animation-name", "none");
  });
});

async function generateAttempt(page: Page) {
  const input = page.getByPlaceholder("输入一个词、一句话，或一段简短说明……").filter({ visible: true });
  await input.fill("蜂巢");
  await page.getByRole("button", { name: "生成 10 个灵感气泡" }).filter({ visible: true }).click();
}
