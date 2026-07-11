import type { LanguageModel } from "ai";

import type { AIProviderId, InspirationIdea } from "@/lib/domain";

export type AITask = "expand" | "summary" | "plan" | "prompt" | "vision";

export interface LanguageModelSelection {
  configuredProvider: AIProviderId;
  provider: AIProviderId;
  modelName: string;
  model: LanguageModel | null;
  demoMode: boolean;
}

export interface ImageAnalysisResult {
  source: string;
  ideas: InspirationIdea[];
  analysis: string;
}
