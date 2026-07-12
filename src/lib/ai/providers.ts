import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

import type { AIRequestConfig } from "@/lib/domain";
import type { LanguageModelSelection } from "@/lib/ai/types";
import { PublicApiError } from "@/lib/server/errors";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const MIMO_BASE_URL = "https://api.xiaomimimo.com/v1";

/**
 * Prevent browser credentials, referrers, caches, and redirects from leaking a
 * user-supplied API key beyond the explicitly selected provider endpoint.
 * SDK headers, body, and abort signal are preserved from `init`.
 */
const privateProviderFetch: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    credentials: "omit",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    redirect: "error",
  });

/**
 * MiMo's OpenAI-compatible endpoint uses the non-standard `api-key` header,
 * as documented in its official curl example. Rewrite the SDK's default
 * Bearer header immediately before the browser request is sent.
 */
function mimoProviderFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    headers.delete("authorization");
    headers.set("api-key", apiKey);
    return privateProviderFetch(input, { ...init, headers });
  };
}

function apiKeyOrThrow(apiKey: string | undefined): string {
  const normalized = apiKey?.trim();
  if (!normalized) {
    throw new PublicApiError("请先在模型设置中填写当前供应商的 API Key。", 401, false);
  }
  if (normalized.length > 2_048) {
    throw new PublicApiError("API Key 格式无效。", 400, false);
  }
  return normalized;
}

function modelOrThrow(config: AIRequestConfig): string {
  const model = config.model?.trim();
  if (!model) {
    throw new PublicApiError("请先填写当前任务使用的模型名称。", 400, false);
  }
  if (model.length > 200) {
    throw new PublicApiError("模型名称格式无效。", 400, false);
  }
  return model;
}

function compatibleBaseURLOrThrow(value: string | undefined): string {
  try {
    const url = new URL(value ?? "");
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      throw new Error("invalid URL");
    }
    return url.toString().replace(/\/$/u, "");
  } catch {
    throw new PublicApiError("OpenAI Compatible Base URL 必须是有效的 HTTPS 地址。", 400, false);
  }
}

/**
 * Creates a fresh provider for every request. Nothing is read from deployment
 * environment variables or retained in a module-level provider singleton.
 */
export function getLanguageModel(config: AIRequestConfig, apiKey?: string): LanguageModelSelection {
  if (config.provider === "mock") {
    return {
      configuredProvider: "mock",
      provider: "mock",
      modelName: "mock",
      model: null,
      demoMode: true,
    };
  }

  const key = apiKeyOrThrow(apiKey);
  const modelName = modelOrThrow(config);

  try {
    if (config.provider === "google") {
      const provider = createGoogleGenerativeAI({ apiKey: key, fetch: privateProviderFetch });
      return {
        configuredProvider: "google",
        provider: "google",
        modelName,
        model: provider(modelName),
        demoMode: false,
      };
    }

    const baseURL =
      config.provider === "deepseek"
        ? DEEPSEEK_BASE_URL
        : config.provider === "mimo"
          ? MIMO_BASE_URL
          : config.provider === "openai-compatible"
            ? compatibleBaseURLOrThrow(config.baseURL)
            : undefined;
    const provider = createOpenAI({
      apiKey: key,
      ...(baseURL ? { baseURL } : {}),
      ...(config.provider !== "openai" ? { name: config.provider } : {}),
      fetch: config.provider === "mimo" ? mimoProviderFetch(key) : privateProviderFetch,
    });

    return {
      configuredProvider: config.provider,
      provider: config.provider,
      modelName,
      model:
        config.provider === "deepseek" ||
        config.provider === "mimo" ||
        config.provider === "openai-compatible"
          ? provider.chat(modelName)
          : provider(modelName),
      demoMode: false,
    };
  } catch (error) {
    if (error instanceof PublicApiError) throw error;
    throw new PublicApiError("AI Provider 初始化失败，请检查供应商和模型设置。", 400, false);
  }
}
