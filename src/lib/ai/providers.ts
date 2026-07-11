import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

import type { AIProviderId, ProviderStatus } from "@/lib/domain";
import { providerIdSchema } from "@/lib/schemas";
import type { AITask, LanguageModelSelection } from "@/lib/ai/types";

type OpenAIProvider = ReturnType<typeof createOpenAI>;
type GoogleProvider = ReturnType<typeof createGoogleGenerativeAI>;

let openAIProvider: OpenAIProvider | undefined;
let googleProvider: GoogleProvider | undefined;
let deepSeekProvider: OpenAIProvider | undefined;
let compatibleProvider: OpenAIProvider | undefined;

const TASK_MODEL_ENV: Record<AITask, string> = {
  expand: "AI_MODEL_EXPAND",
  summary: "AI_MODEL_SUMMARY",
  plan: "AI_MODEL_PLAN",
  prompt: "AI_MODEL_PROMPT",
  vision: "AI_MODEL_VISION",
};

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function validHttpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function configuredProvider(requested?: AIProviderId): AIProviderId {
  if (requested) return requested;
  const parsed = providerIdSchema.safeParse(env("AI_PROVIDER") ?? "mock");
  return parsed.success ? parsed.data : "mock";
}

function taskModel(task: AITask, provider: AIProviderId): string | undefined {
  const taskSpecific = env(TASK_MODEL_ENV[task]);
  if (taskSpecific) return taskSpecific;
  return provider === "openai-compatible" ? env("CUSTOM_AI_MODEL") : undefined;
}

function hasProviderCredentials(provider: AIProviderId): boolean {
  switch (provider) {
    case "openai":
      return Boolean(env("OPENAI_API_KEY"));
    case "google":
      return Boolean(env("GOOGLE_GENERATIVE_AI_API_KEY"));
    case "deepseek":
      return Boolean(env("DEEPSEEK_API_KEY"));
    case "openai-compatible":
      return Boolean(env("CUSTOM_AI_API_KEY") && validHttpUrl(env("CUSTOM_AI_BASE_URL")));
    case "mock":
      return true;
  }
}

function getOpenAIProvider(): OpenAIProvider | null {
  const apiKey = env("OPENAI_API_KEY");
  if (!apiKey) return null;
  openAIProvider ??= createOpenAI({ apiKey });
  return openAIProvider;
}

function getGoogleProvider(): GoogleProvider | null {
  const apiKey = env("GOOGLE_GENERATIVE_AI_API_KEY");
  if (!apiKey) return null;
  googleProvider ??= createGoogleGenerativeAI({ apiKey });
  return googleProvider;
}

function getDeepSeekProvider(): OpenAIProvider | null {
  const apiKey = env("DEEPSEEK_API_KEY");
  if (!apiKey) return null;
  deepSeekProvider ??= createOpenAI({
    apiKey,
    baseURL: validHttpUrl(env("DEEPSEEK_BASE_URL")) ?? "https://api.deepseek.com",
    name: "deepseek",
  });
  return deepSeekProvider;
}

function getCompatibleProvider(): OpenAIProvider | null {
  const apiKey = env("CUSTOM_AI_API_KEY");
  const baseURL = validHttpUrl(env("CUSTOM_AI_BASE_URL"));
  if (!apiKey || !baseURL) return null;
  compatibleProvider ??= createOpenAI({
    apiKey,
    baseURL,
    name: "openai-compatible",
  });
  return compatibleProvider;
}

export function getLanguageModel(task: AITask, requestedProvider?: AIProviderId): LanguageModelSelection {
  const configured = configuredProvider(requestedProvider);
  const modelName = taskModel(task, configured);

  if (configured === "mock" || !modelName || !hasProviderCredentials(configured)) {
    return {
      configuredProvider: configured,
      provider: "mock",
      modelName: "mock",
      model: null,
      demoMode: true,
    };
  }

  const provider =
    configured === "openai"
      ? getOpenAIProvider()
      : configured === "google"
        ? getGoogleProvider()
        : configured === "deepseek"
          ? getDeepSeekProvider()
          : getCompatibleProvider();

  if (!provider) {
    return {
      configuredProvider: configured,
      provider: "mock",
      modelName: "mock",
      model: null,
      demoMode: true,
    };
  }

  return {
    configuredProvider: configured,
    provider: configured,
    modelName,
    model: provider(modelName),
    demoMode: false,
  };
}

export function getProviderStatus(): ProviderStatus {
  const configured = configuredProvider();
  const tasks: AITask[] = ["expand", "summary", "plan", "prompt", "vision"];
  const resolved = Object.fromEntries(
    tasks.map((task) => {
      const name =
        configured !== "mock" && hasProviderCredentials(configured)
          ? (taskModel(task, configured) ?? "mock")
          : "mock";
      return [task, name];
    }),
  ) as Record<AITask, string>;
  const hasRealTask = Object.values(resolved).some((name) => name !== "mock");
  const demoMode = Object.values(resolved).some((name) => name === "mock");

  return {
    configuredProvider: configured,
    activeProvider: hasRealTask ? configured : "mock",
    demoMode,
    taskModels: {
      expand: resolved.expand,
      summary: resolved.summary,
      plan: resolved.plan,
      prompt: resolved.prompt,
      vision: resolved.vision,
    },
    availableProviders: {
      openai: hasProviderCredentials("openai"),
      google: hasProviderCredentials("google"),
      deepseek: hasProviderCredentials("deepseek"),
      "openai-compatible": hasProviderCredentials("openai-compatible"),
      mock: true,
    },
  };
}
