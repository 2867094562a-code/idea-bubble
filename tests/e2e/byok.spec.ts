import { expect, test, type Page } from "@playwright/test";

const STORAGE_KEY = "idea-bubble:ai-config:v1";
const PROVIDER_BASE_URL = "https://provider.example/v1";
const PROVIDER_ROUTE = `${PROVIDER_BASE_URL}/chat/completions`;
const SENTINEL_KEY = "sentinel-local-byok-key";

async function createProject(page: Page, name: string) {
  await page.goto("/");
  await page.getByPlaceholder("例如：蜂巢城市通勤鞋").fill(name);
  await page.getByRole("button", { name: "创建灵感空间" }).click();
}

async function chooseCompatibleProvider(page: Page) {
  await page.getByRole("button", { name: /模型设置：/ }).click();
  await page.getByLabel("Provider").click();
  await page.getByRole("option", { name: "OpenAI Compatible" }).click();
  await page.getByRole("textbox", { name: "API Key", exact: true }).fill(SENTINEL_KEY);
  await page.getByLabel("HTTPS Base URL").fill(PROVIDER_BASE_URL);
  for (const [label, model] of [
    ["灵感发散", "user-expand-model"],
    ["概念总结", "user-summary-model"],
    ["项目计划", "user-plan-model"],
    ["生图提示词", "user-prompt-model"],
    ["图片分析", "user-vision-model"],
  ] as const) {
    await page.getByLabel(label).fill(model);
  }
  await page.getByRole("button", { name: "保存到当前浏览器" }).click();
}

function ideas() {
  return Array.from({ length: 10 }, (_, index) => ({
    word: `用户模型灵感${index}`,
    category: "结构",
    reason: `用户模型围绕蜂巢生成的关联理由 ${index}`,
    visualHint: `六边形视觉提示 ${index}`,
    relevance: 0.8,
  }));
}

function completion() {
  return {
    id: "chatcmpl-byok-e2e",
    object: "chat.completion",
    created: 1,
    model: "user-expand-model",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: JSON.stringify({ source: "蜂巢", ideas: ideas() }),
        },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  };
}

async function readProjects(page: Page) {
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open("idea-bubble");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const database = open.result;
          const request = database.transaction("projects", "readonly").objectStore("projects").getAll();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(JSON.stringify(request.result));
        };
      }),
  );
}

test.describe("浏览器本地 BYOK", () => {
  test("配置刷新保留、仅直连 Provider，且与项目和其他浏览器隔离", async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "完整 BYOK 隔离只运行一次");

    const sameOriginLeaks: string[] = [];
    const sameOriginAIRoutes: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.origin !== "http://127.0.0.1:3100") return;
      const serialized = `${request.url()}\n${JSON.stringify(request.headers())}\n${request.postData() || ""}`;
      if (serialized.includes(SENTINEL_KEY)) sameOriginLeaks.push(request.url());
      if (url.pathname.startsWith("/api/ai/")) sameOriginAIRoutes.push(request.url());
    });

    await createProject(page, "BYOK 隔离验收");
    await expect(page.getByRole("button", { name: "模型设置：Mock 演示" })).toBeVisible();
    await chooseCompatibleProvider(page);
    await expect(page.getByRole("button", { name: "模型设置：OpenAI Compatible" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: "模型设置：OpenAI Compatible" })).toBeVisible();
    await page.getByRole("button", { name: "模型设置：OpenAI Compatible" }).click();
    await expect(page.getByRole("textbox", { name: "API Key", exact: true })).toHaveValue(SENTINEL_KEY);
    await expect(page.getByLabel("灵感发散")).toHaveValue("user-expand-model");
    await page.keyboard.press("Escape");

    let providerCalls = 0;
    await page.route(PROVIDER_ROUTE, async (route) => {
      providerCalls += 1;
      expect(route.request().headers().authorization).toBe(`Bearer ${SENTINEL_KEY}`);
      const body = JSON.parse(route.request().postData() || "{}") as { model?: string };
      expect(body.model).toBe("user-expand-model");
      expect(route.request().url()).not.toContain(SENTINEL_KEY);
      expect(route.request().postData() || "").not.toContain(SENTINEL_KEY);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(completion()),
      });
    });

    const input = page.getByPlaceholder("输入一个词、一句话，或一段简短说明……").filter({ visible: true });
    await input.fill("蜂巢");
    await page.getByRole("button", { name: "生成 10 个灵感气泡" }).filter({ visible: true }).click();
    await expect(page.locator(".bubble-surface")).toHaveCount(11);
    expect(providerCalls).toBe(1);
    expect(sameOriginLeaks).toEqual([]);
    expect(sameOriginAIRoutes).toEqual([]);
    expect(await page.evaluate(() => document.cookie)).not.toContain(SENTINEL_KEY);
    expect(await readProjects(page)).not.toContain(SENTINEL_KEY);

    const secondContext = await browser.newContext();
    const secondPage = await secondContext.newPage();
    await secondPage.goto("http://127.0.0.1:3100/");
    expect(await secondPage.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBeNull();
    await secondContext.close();

    await page.getByRole("button", { name: "模型设置：OpenAI Compatible" }).click();
    await page.getByRole("button", { name: "清除本地配置" }).click();
    await expect(page.getByRole("button", { name: "模型设置：Mock 演示" })).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBeNull();
  });

  test("移动端设置弹窗可完整保存且不溢出视口", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "移动 BYOK 设置只运行一次");
    await createProject(page, "移动 BYOK 验收");
    await page.getByRole("button", { name: "模型设置：Mock 演示" }).click();

    const dialog = page.getByRole("dialog", { name: "模型设置" });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);

    await page.getByLabel("Provider").click();
    await page.getByRole("option", { name: "OpenAI", exact: true }).click();
    await page.getByRole("textbox", { name: "API Key", exact: true }).fill("mobile-local-key");
    await page.getByLabel("灵感发散").fill("mobile-user-model");
    await page.getByRole("button", { name: "保存到当前浏览器" }).click();
    await expect(page.getByRole("button", { name: "模型设置：OpenAI" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: "模型设置：OpenAI" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
