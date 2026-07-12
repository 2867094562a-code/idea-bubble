import { beforeEach, describe, expect, it } from "vitest";

import {
  AI_CONFIG_STORAGE_KEY,
  clearLocalAIConfig,
  createDefaultAIConfig,
  prepareAIRequest,
  readLocalAIConfig,
  writeLocalAIConfig,
} from "@/lib/client-ai-config";

describe("浏览器本地 BYOK 配置", () => {
  beforeEach(() => window.localStorage.clear());

  it("新浏览器与损坏数据都会安全回退到 Mock", () => {
    expect(readLocalAIConfig()).toEqual(createDefaultAIConfig());
    window.localStorage.setItem(AI_CONFIG_STORAGE_KEY, "{broken");
    expect(readLocalAIConfig()).toEqual(createDefaultAIConfig());
  });

  it("只保存在当前浏览器并能完整清除", () => {
    const saved = writeLocalAIConfig({
      provider: "openai",
      apiKey: "  test-local-key  ",
      baseURL: "",
      models: {
        expand: " model-expand ",
        summary: "model-summary",
        plan: "model-plan",
        prompt: "model-prompt",
        vision: "model-vision",
      },
    });

    expect(saved.apiKey).toBe("test-local-key");
    expect(readLocalAIConfig()).toEqual(saved);
    expect(clearLocalAIConfig()).toEqual(createDefaultAIConfig());
    expect(window.localStorage.getItem(AI_CONFIG_STORAGE_KEY)).toBeNull();
  });

  it("每次只准备当前任务的模型，Mock 不携带密钥", () => {
    expect(prepareAIRequest(createDefaultAIConfig(), "expand")).toEqual({
      ai: { provider: "mock" },
    });

    const request = prepareAIRequest(
      {
        provider: "openai",
        apiKey: "local-key",
        baseURL: "",
        models: {
          expand: "expand-model",
          summary: "summary-model",
          plan: "plan-model",
          prompt: "prompt-model",
          vision: "vision-model",
        },
      },
      "summary",
    );

    expect(request).toEqual({
      ai: { provider: "openai", model: "summary-model" },
      apiKey: "local-key",
    });
    expect(JSON.stringify(request.ai)).not.toContain("local-key");
    expect(JSON.stringify(request.ai)).not.toContain("expand-model");
  });

  it("真实 Provider 缺少 Key/任务模型时阻止调用", () => {
    const config = {
      ...createDefaultAIConfig(),
      provider: "google" as const,
    };
    expect(() => prepareAIRequest(config, "expand")).toThrow("API Key");
    expect(() => prepareAIRequest({ ...config, apiKey: "google-key" }, "expand")).toThrow("灵感发散");
  });

  it("Compatible 只接受用户填写的 HTTPS 地址", () => {
    const config = {
      provider: "openai-compatible" as const,
      apiKey: "compatible-key",
      baseURL: "http://example.com/v1",
      models: {
        expand: "custom-model",
        summary: "",
        plan: "",
        prompt: "",
        vision: "",
      },
    };
    expect(() => prepareAIRequest(config, "expand")).toThrow("HTTPS Base URL");
    expect(() =>
      prepareAIRequest({ ...config, baseURL: "https://example.com/v1?key=unsafe" }, "expand"),
    ).toThrow("HTTPS Base URL");
    expect(prepareAIRequest({ ...config, baseURL: "https://example.com/v1" }, "expand").ai).toEqual({
      provider: "openai-compatible",
      model: "custom-model",
      baseURL: "https://example.com/v1",
    });
  });
});
