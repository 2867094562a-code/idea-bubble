import type { AIProviderConfig, AIProviderId, AIRequestConfig, AITask } from "@/lib/domain";
import { ApiError } from "@/lib/api-client";

export const AI_CONFIG_STORAGE_KEY = "idea-bubble:ai-config:v1";

export const AI_TASK_LABELS: Record<AITask, string> = {
  expand: "灵感发散",
  summary: "概念总结",
  plan: "项目计划",
  prompt: "生图提示词",
  vision: "图片分析",
};

const PROVIDERS = new Set<AIProviderId>([
  "openai",
  "google",
  "deepseek",
  "mimo",
  "openai-compatible",
  "mock",
]);

function clean(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export function createDefaultAIConfig(): AIProviderConfig {
  return {
    provider: "mock",
    apiKey: "",
    baseURL: "",
    models: {
      expand: "",
      summary: "",
      plan: "",
      prompt: "",
      vision: "",
    },
  };
}

export function normalizeAIConfig(value: Partial<AIProviderConfig>): AIProviderConfig {
  const fallback = createDefaultAIConfig();
  const provider = PROVIDERS.has(value.provider as AIProviderId)
    ? (value.provider as AIProviderId)
    : fallback.provider;
  return {
    provider,
    apiKey: clean(value.apiKey, 4_096),
    baseURL: clean(value.baseURL, 2_048),
    models: {
      expand: clean(value.models?.expand, 200),
      summary: clean(value.models?.summary, 200),
      plan: clean(value.models?.plan, 200),
      prompt: clean(value.models?.prompt, 200),
      vision: clean(value.models?.vision, 200),
    },
  };
}

export function readLocalAIConfig(): AIProviderConfig {
  if (typeof window === "undefined") return createDefaultAIConfig();
  const raw = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY);
  if (!raw) return createDefaultAIConfig();
  try {
    return normalizeAIConfig(JSON.parse(raw) as Partial<AIProviderConfig>);
  } catch {
    return createDefaultAIConfig();
  }
}

export function writeLocalAIConfig(value: AIProviderConfig): AIProviderConfig {
  const normalized = normalizeAIConfig(value);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export function clearLocalAIConfig(): AIProviderConfig {
  const fallback = createDefaultAIConfig();
  if (typeof window !== "undefined") window.localStorage.removeItem(AI_CONFIG_STORAGE_KEY);
  return fallback;
}

function validPublicBaseURL(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

export function prepareAIRequest(
  config: AIProviderConfig,
  task: AITask,
): { ai: AIRequestConfig; apiKey?: string } {
  const normalized = normalizeAIConfig(config);
  if (normalized.provider === "mock") return { ai: { provider: "mock" } };

  if (!normalized.apiKey) {
    throw new ApiError("请先在模型设置中填写当前供应商的 API Key。", 400, false);
  }

  const model = normalized.models[task];
  if (!model) {
    throw new ApiError(`请先在模型设置中填写“${AI_TASK_LABELS[task]}”使用的模型名称。`, 400, false);
  }

  if (
    (normalized.provider === "openai-compatible" && !validPublicBaseURL(normalized.baseURL)) ||
    (normalized.provider === "mimo" && normalized.baseURL && !validPublicBaseURL(normalized.baseURL))
  ) {
    throw new ApiError("OpenAI Compatible 需要填写有效的 HTTPS Base URL。", 400, false);
  }

  return {
    ai: {
      provider: normalized.provider,
      model,
      ...(normalized.provider === "openai-compatible" ||
      (normalized.provider === "mimo" && normalized.baseURL)
        ? { baseURL: normalized.baseURL }
        : {}),
    },
    apiKey: normalized.apiKey,
  };
}

export function configuredTaskCount(config: AIProviderConfig): number {
  return Object.values(config.models).filter(Boolean).length;
}
