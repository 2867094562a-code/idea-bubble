import { z } from "zod";
import type { AIRequestConfig } from "@/lib/domain";
import { normalizeIdeaWord } from "@/lib/idea-normalization";
import { MAX_ANALYZABLE_IMAGE_BYTES, MAX_INLINE_DATA_URL_CHARS } from "@/lib/payload-limits";

export const providerIdSchema = z.enum(["openai", "google", "deepseek", "mimo", "openai-compatible", "mock"]);

const aiModelSchema = z.string().trim().min(1).max(200);

const compatibleBaseURLSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
    } catch {
      return false;
    }
  }, "OpenAI Compatible Base URL 必须是有效的 HTTPS 地址");

/**
 * Public, non-secret model routing information. The API key is deliberately
 * excluded and is only supplied directly to the provider factory at runtime.
 */
export const aiRequestConfigSchema: z.ZodType<AIRequestConfig> = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("mock") }).strict(),
  z.object({ provider: z.literal("openai"), model: aiModelSchema }).strict(),
  z.object({ provider: z.literal("google"), model: aiModelSchema }).strict(),
  z.object({ provider: z.literal("deepseek"), model: aiModelSchema }).strict(),
  z
    .object({
      provider: z.literal("mimo"),
      model: aiModelSchema,
      baseURL: compatibleBaseURLSchema.optional(),
    })
    .strict(),
  z
    .object({
      provider: z.literal("openai-compatible"),
      model: aiModelSchema,
      baseURL: compatibleBaseURLSchema,
    })
    .strict(),
]);

export const inspirationIdeaSchema = z.object({
  word: z.string().trim().min(1).max(30),
  category: z.string().trim().min(1).max(20),
  reason: z.string().trim().min(1).max(160),
  visualHint: z.string().trim().min(1).max(120),
  relevance: z.number().min(0).max(1),
});

export const expansionResultSchema = z
  .object({
    source: z.string().trim().min(1).max(200),
    ideas: z.array(inspirationIdeaSchema).length(10),
  })
  .superRefine((value, context) => {
    const words = value.ideas.map((idea) => normalizeIdeaWord(idea.word));
    if (new Set(words).size !== words.length) {
      context.addIssue({
        code: "custom",
        path: ["ideas"],
        message: "同一批结果中不能出现重复词语",
      });
    }
  });

export const conceptSummarySchema = z.object({
  title: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(20).max(1200),
  keywords: z.array(z.string().trim().min(1)).min(1).max(20),
  conflicts: z.array(z.string().trim().min(1)).max(10),
  questions: z.array(z.string().trim().min(1)).max(10),
  sourceNodeIds: z.array(z.string().min(1)).min(1),
});

export const executionStepSchema = z.object({
  stage: z.string().trim().min(1),
  objective: z.string().trim().min(1),
  tasks: z.array(z.string().trim().min(1)),
  deliverables: z.array(z.string().trim().min(1)),
  estimatedDependencies: z.array(z.string().trim().min(1)),
});

export const projectPlanSchema = z.object({
  projectName: z.string().trim().min(1),
  subtitle: z.string(),
  oneLineConcept: z.string().trim().min(1),
  executiveSummary: z.string().trim().min(20),
  background: z.string().trim().min(1),
  problemDefinition: z.string().trim().min(1),
  targetAudience: z.array(z.string()),
  usageScenarios: z.array(z.string()),
  projectGoals: z.array(z.string()),
  coreIdeas: z.array(z.string()),
  designDirection: z.array(z.string()),
  visualDirection: z.array(z.string()),
  functionalDirection: z.array(z.string()),
  materialsOrResources: z.array(z.string()),
  colorDirection: z.array(z.string()),
  executionSteps: z.array(executionStepSchema).min(1),
  risks: z.array(z.string()),
  validationMethods: z.array(z.string()),
  nextActions: z.array(z.string()),
  sourceNodeIds: z.array(z.string()).min(1),
});

export const imagePromptSchema = z.object({
  promptCN: z.string().trim().min(1),
  promptEN: z.string().trim().min(1),
  subject: z.string(),
  style: z.string(),
  composition: z.string(),
  materials: z.array(z.string()),
  colorPalette: z.array(z.string()),
  lighting: z.string(),
  camera: z.string(),
  negativePrompt: z.array(z.string()),
  sourceIdeas: z.array(z.string()),
  sourceNodeIds: z.array(z.string()),
});

export const projectInfoSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(["鞋类设计", "产品设计", "品牌设计", "平面视觉", "视频创意", "通用头脑风暴", "自定义"]),
  customType: z.string().max(40).optional(),
  goal: z.string().max(500),
  audience: z.string().max(300),
  scenario: z.string().max(300),
  requirements: z.string().max(1000),
  forbiddenElements: z.string().max(500),
});

export const expandRequestSchema = z.object({
  source: z.string().trim().min(1).max(500),
  parentNodeId: z.string().optional(),
  sourceAssetId: z.string().optional(),
  existingWords: z.array(z.string().max(50)).max(200).default([]),
  ai: aiRequestConfigSchema,
  direction: z.enum(["balanced", "practical", "bold", "cross-domain", "specific"]).default("balanced"),
});

export const summarizeRequestSchema = z.object({
  projectInfo: projectInfoSchema,
  collectedIdeas: z
    .array(
      z.object({
        id: z.string(),
        word: z.string(),
        category: z.string(),
        reason: z.string(),
      }),
    )
    .min(3)
    .max(10),
  ai: aiRequestConfigSchema,
  tone: z.enum(["default", "concise", "professional", "bold", "commercial", "visual"]).default("default"),
});

export const planRequestSchema = z.object({
  projectInfo: projectInfoSchema,
  concept: conceptSummarySchema,
  collectedIdeas: z
    .array(inspirationIdeaSchema.extend({ id: z.string() }))
    .min(3)
    .max(10),
  ai: aiRequestConfigSchema,
});

export const promptRequestSchema = z.object({
  projectInfo: projectInfoSchema,
  plan: projectPlanSchema,
  ai: aiRequestConfigSchema,
});

export const analyzeAssetRequestSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().max(200),
  mimeType: z.string().max(100),
  size: z.number().int().positive().max(MAX_ANALYZABLE_IMAGE_BYTES),
  dataUrl: z.string().max(MAX_INLINE_DATA_URL_CHARS),
  ai: aiRequestConfigSchema,
});

export type ExpansionResult = z.infer<typeof expansionResultSchema>;

export function filterDuplicateIdeas<T extends { word: string }>(ideas: T[], existingWords: string[]): T[] {
  const existing = new Set(existingWords.map(normalizeIdeaWord));
  const batch = new Set<string>();
  return ideas.filter((idea) => {
    const normalized = normalizeIdeaWord(idea.word);
    if (!normalized || existing.has(normalized) || batch.has(normalized)) return false;
    batch.add(normalized);
    return true;
  });
}
