import type { LanguageModel } from "ai";

import type { AIProviderId, AITask, InspirationIdea } from "@/lib/domain";

export type { AITask };

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
