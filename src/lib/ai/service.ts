import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";

import {
  generateMockExpansion,
  generateMockImageAnalysis,
  generateMockImagePrompt,
  generateMockPlan,
  generateMockSummary,
} from "@/lib/ai/mock";
import { getLanguageModel } from "@/lib/ai/providers";
import {
  expansionPrompt,
  expansionRepairPrompt,
  imageAnalysisInstruction,
  imagePromptPrompt,
  planPrompt,
  summaryPrompt,
} from "@/lib/ai/prompts";
import { imageAnalysisResultSchema, repairedIdeasSchema } from "@/lib/ai/schemas";
import type { ImageAnalysisResult, LanguageModelSelection } from "@/lib/ai/types";
import type { ConceptSummary, ImagePrompt, ProjectPlan } from "@/lib/domain";
import {
  analyzeAssetRequestSchema,
  conceptSummarySchema,
  expandRequestSchema,
  expansionResultSchema,
  filterDuplicateIdeas,
  imagePromptSchema,
  planRequestSchema,
  projectPlanSchema,
  promptRequestSchema,
  summarizeRequestSchema,
  type ExpansionResult,
} from "@/lib/schemas";
import { isAbortLikeError, PublicApiError } from "@/lib/server/errors";

type ExpandInput = z.infer<typeof expandRequestSchema>;
type SummarizeInput = z.infer<typeof summarizeRequestSchema>;
type PlanInput = z.infer<typeof planRequestSchema>;
type PromptInput = z.infer<typeof promptRequestSchema>;
type AnalyzeAssetInput = z.infer<typeof analyzeAssetRequestSchema>;

interface GenerateOptions<T> {
  selection: LanguageModelSelection;
  schema: z.ZodType<T>;
  schemaName: string;
  schemaDescription: string;
  system: string;
  signal?: AbortSignal;
  prompt?: string;
  messages?: Parameters<typeof generateText>[0]["messages"];
}

const MIMO_JSON_SYSTEM_SUFFIX = [
  "你正在调用 Xiaomi MiMo 的 Chat Completions 接口。",
  "请只返回一个可被 JSON.parse 解析的完整 JSON 对象。",
  "不要输出 Markdown 代码块、解释、前缀、后缀或 reasoning_content。",
].join("\n");

function extractJsonObject(text: string): string {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  let start = -1;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < trimmed.length; index += 1) {
    const character = trimmed[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') {
      quoted = true;
      continue;
    }
    if (character === "{") {
      if (start < 0) start = index;
      depth += 1;
    } else if (character === "}" && start >= 0) {
      depth -= 1;
      if (depth === 0) return trimmed.slice(start, index + 1);
    }
  }
  throw new z.ZodError([]);
}

async function generateStructured<T>(options: GenerateOptions<T>): Promise<T> {
  if (!options.selection.model) {
    throw new PublicApiError("当前任务未配置可用模型。", 503, false);
  }

  if (options.selection.provider === "mimo") {
    const common = {
      model: options.selection.model,
      system: `${options.system}\n${MIMO_JSON_SYSTEM_SUFFIX}`,
      abortSignal: options.signal,
      maxRetries: 0,
    } as const;
    const result = options.messages
      ? await generateText({ ...common, messages: options.messages })
      : await generateText({ ...common, prompt: options.prompt ?? "" });
    return options.schema.parse(JSON.parse(extractJsonObject(result.text)));
  }

  const output = Output.object({
    schema: options.schema,
    name: options.schemaName,
    description: options.schemaDescription,
  });
  const common = {
    model: options.selection.model,
    output,
    system: options.system,
    abortSignal: options.signal,
    // BYOK calls are user-funded. Do not add invisible SDK retries; expansion
    // keeps its explicit, bounded one-time structured-output repair below.
    maxRetries: 0,
  } as const;
  const result = options.messages
    ? await generateText({ ...common, messages: options.messages })
    : await generateText({ ...common, prompt: options.prompt ?? "" });

  return options.schema.parse(result.output);
}

function structuredOutputFailure(error: unknown): boolean {
  return NoObjectGeneratedError.isInstance(error) || error instanceof z.ZodError;
}

function providerFailure(error: unknown, signal?: AbortSignal): never {
  if (error instanceof PublicApiError) throw error;
  if (signal?.aborted || isAbortLikeError(error)) {
    throw new PublicApiError("AI 请求已取消。", 408, true);
  }
  throw new PublicApiError(
    "AI 调用失败，请检查 API Key、模型名称，以及该接口是否允许浏览器跨域访问。",
    502,
    true,
  );
}

async function repairExpansion(
  input: ExpandInput,
  selection: LanguageModelSelection,
  accepted: ExpansionResult["ideas"],
  signal?: AbortSignal,
): Promise<ExpansionResult> {
  const missingCount = 10 - accepted.length;
  const repair = expansionRepairPrompt(
    input,
    accepted.map((idea) => idea.word),
    missingCount,
  );
  const repairSchema = repairedIdeasSchema(missingCount);

  try {
    const repaired = await generateStructured({
      selection,
      schema: repairSchema,
      schemaName: "idea_expansion_repair",
      schemaDescription: `补充 ${missingCount} 个不重复灵感`,
      system: repair.system,
      prompt: repair.prompt,
      signal,
    });
    const combined = filterDuplicateIdeas([...accepted, ...repaired.ideas], input.existingWords).slice(0, 10);
    return expansionResultSchema.parse({
      source: input.source.trim().slice(0, 200),
      ideas: combined,
    });
  } catch (error) {
    if (signal?.aborted || isAbortLikeError(error)) {
      throw new PublicApiError("AI 请求已取消。", 408, true);
    }
    throw new PublicApiError("AI 未能返回 10 个不重复灵感，请重试或调整输入。", 502, true);
  }
}

export async function expandInspiration(
  input: ExpandInput,
  signal?: AbortSignal,
  apiKey?: string,
): Promise<ExpansionResult> {
  const selection = getLanguageModel(input.ai, apiKey);
  if (selection.provider === "mock") return generateMockExpansion(input);

  const request = expansionPrompt(input);
  try {
    const initial = await generateStructured({
      selection,
      schema: expansionResultSchema,
      schemaName: "idea_expansion",
      schemaDescription: "严格包含 10 个不重复灵感的发散结果",
      system: request.system,
      prompt: request.prompt,
      signal,
    });
    const accepted = filterDuplicateIdeas(initial.ideas, input.existingWords).slice(0, 10);
    if (accepted.length === 10) {
      return expansionResultSchema.parse({
        source: input.source.trim().slice(0, 200),
        ideas: accepted,
      });
    }
    return repairExpansion(input, selection, accepted, signal);
  } catch (error) {
    if (structuredOutputFailure(error)) {
      return repairExpansion(input, selection, [], signal);
    }
    providerFailure(error, signal);
  }
}

export async function summarizeCollectedIdeas(
  input: SummarizeInput,
  signal?: AbortSignal,
  apiKey?: string,
): Promise<ConceptSummary> {
  const selection = getLanguageModel(input.ai, apiKey);
  if (selection.provider === "mock") return generateMockSummary(input);
  const request = summaryPrompt(input);

  try {
    const generated = await generateStructured({
      selection,
      schema: conceptSummarySchema,
      schemaName: "concept_summary",
      schemaDescription: "可编辑且可追溯的中文创意总结",
      system: request.system,
      prompt: request.prompt,
      signal,
    });
    return conceptSummarySchema.parse({
      ...generated,
      sourceNodeIds: input.collectedIdeas.map((idea) => idea.id),
    });
  } catch (error) {
    providerFailure(error, signal);
  }
}

export async function generateProjectPlan(
  input: PlanInput,
  signal?: AbortSignal,
  apiKey?: string,
): Promise<ProjectPlan> {
  const selection = getLanguageModel(input.ai, apiKey);
  if (selection.provider === "mock") return generateMockPlan(input);
  const request = planPrompt(input);

  try {
    const generated = await generateStructured({
      selection,
      schema: projectPlanSchema,
      schemaName: "project_plan",
      schemaDescription: "分章节、可执行且可追溯的完整项目计划",
      system: request.system,
      prompt: request.prompt,
      signal,
    });
    return projectPlanSchema.parse({
      ...generated,
      projectName: input.projectInfo.name,
      sourceNodeIds: input.collectedIdeas.map((idea) => idea.id),
    });
  } catch (error) {
    providerFailure(error, signal);
  }
}

export async function generateImagePrompt(
  input: PromptInput,
  signal?: AbortSignal,
  apiKey?: string,
): Promise<ImagePrompt> {
  const selection = getLanguageModel(input.ai, apiKey);
  if (selection.provider === "mock") return generateMockImagePrompt(input);
  const request = imagePromptPrompt(input);

  try {
    const generated = await generateStructured({
      selection,
      schema: imagePromptSchema,
      schemaName: "image_prompt",
      schemaDescription: "与项目计划一致的中英文图像生成提示词",
      system: request.system,
      prompt: request.prompt,
      signal,
    });
    return imagePromptSchema.parse({
      ...generated,
      sourceIdeas: input.plan.coreIdeas,
      sourceNodeIds: input.plan.sourceNodeIds,
    });
  } catch (error) {
    providerFailure(error, signal);
  }
}

async function realImageAnalysis(
  input: AnalyzeAssetInput,
  selection: LanguageModelSelection,
  signal?: AbortSignal,
  repair = false,
): Promise<ImageAnalysisResult> {
  const instruction = `${imageAnalysisInstruction(input.name)}${
    repair ? "\n上一次输出不符合结构；这是唯一一次修复，请特别检查数量和重复词。" : ""
  }`;
  return generateStructured({
    selection,
    schema: imageAnalysisResultSchema,
    schemaName: repair ? "image_analysis_repair" : "image_analysis",
    schemaDescription: "客观图片分析和严格 10 个视觉灵感",
    system: "你是视觉素材分析助手。仅描述图片中可见信息，并严格返回指定结构。",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: instruction },
          { type: "image", image: input.dataUrl, mediaType: input.mimeType },
        ],
      },
    ],
    signal,
  });
}

export async function analyzeImageAsset(
  input: AnalyzeAssetInput,
  signal?: AbortSignal,
  apiKey?: string,
): Promise<ImageAnalysisResult> {
  const selection = getLanguageModel(input.ai, apiKey);
  if (selection.provider === "mock") return generateMockImageAnalysis(input);

  try {
    const generated = await realImageAnalysis(input, selection, signal);
    return imageAnalysisResultSchema.parse({
      ...generated,
      source: input.name.slice(0, 200),
      ideas: filterDuplicateIdeas(generated.ideas, []).slice(0, 10),
    });
  } catch (error) {
    if (!structuredOutputFailure(error)) providerFailure(error, signal);
  }

  try {
    const repaired = await realImageAnalysis(input, selection, signal, true);
    return imageAnalysisResultSchema.parse({
      ...repaired,
      source: input.name.slice(0, 200),
      ideas: filterDuplicateIdeas(repaired.ideas, []).slice(0, 10),
    });
  } catch (error) {
    if (signal?.aborted || isAbortLikeError(error)) {
      throw new PublicApiError("AI 请求已取消。", 408, true);
    }
    throw new PublicApiError("AI 未能生成有效的图片分析和 10 个灵感，请重试。", 502, true);
  }
}
