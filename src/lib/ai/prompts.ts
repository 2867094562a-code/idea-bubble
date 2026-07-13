import type { z } from "zod";

import type {
  expandRequestSchema,
  planRequestSchema,
  promptRequestSchema,
  summarizeRequestSchema,
} from "@/lib/schemas";

type ExpandInput = z.infer<typeof expandRequestSchema>;
type SummarizeInput = z.infer<typeof summarizeRequestSchema>;
type PlanInput = z.infer<typeof planRequestSchema>;
type PromptInput = z.infer<typeof promptRequestSchema>;

const JSON_ONLY_SYSTEM = [
  "你是 Idea Bubble 的中文创意协作引擎。",
  "严格遵守给定结构，不要输出 Markdown、代码块或结构外说明。",
  "所有结论必须能从用户提供的信息追溯，不虚构调研数据或已完成的验证。",
].join("\n");

export function expansionPrompt(input: ExpandInput): {
  system: string;
  prompt: string;
} {
  const dimensions = [
    "2 个形态或结构词",
    "2 个功能或体验词",
    "2 个材质或工艺词",
    "1 个情绪氛围词",
    "1 个使用场景词",
    "1 个跨界联想词",
    "1 个冲突或反向创意词",
  ];
  return {
    system: `${JSON_ONLY_SYSTEM}\n你负责发散灵感。必须返回恰好 10 个中文词语，同批及禁用列表中均不得重复。`,
    prompt: [
      `围绕以下来源生成灵感：${input.source}`,
      `方向偏好：${input.direction}`,
      `维度配比：${dimensions.join("；")}`,
      `禁止重复词：${JSON.stringify(input.existingWords)}`,
      "reason 要说明与来源的具体关系；visualHint 要能被设计师直接想象；relevance 为 0 到 1。",
    ].join("\n"),
  };
}

export function expansionRepairPrompt(
  input: ExpandInput,
  acceptedWords: string[],
  missingCount: number,
): { system: string; prompt: string } {
  return {
    system: `${JSON_ONLY_SYSTEM}\n这是唯一一次格式修复。只补足要求数量的灵感，不能重复。`,
    prompt: [
      `来源：${input.source}`,
      `还需补充：${missingCount} 个`,
      `已接受词：${JSON.stringify(acceptedWords)}`,
      `画布已有词：${JSON.stringify(input.existingWords)}`,
      "生成与已接受内容方向不同的新词，并完整填写 category、reason、visualHint、relevance。",
    ].join("\n"),
  };
}

export function summaryPrompt(input: SummarizeInput): {
  system: string;
  prompt: string;
} {
  return {
    system: `${JSON_ONLY_SYSTEM}\n你负责把用户主动收集的灵感整理成 150 至 300 字、可编辑的创意说明。`,
    prompt: [
      `表达风格：${input.tone}`,
      `项目信息：${JSON.stringify(input.projectInfo)}`,
      `已收集灵感：${JSON.stringify(input.collectedIdeas)}`,
      "sourceNodeIds 必须且只能使用输入灵感的 id。指出真实的潜在冲突和仍需确认的问题。",
    ].join("\n"),
  };
}

export function planPrompt(input: PlanInput): {
  system: string;
  prompt: string;
} {
  return {
    system: `${JSON_ONLY_SYSTEM}\n你负责把已确认的创意总结转化为完整、分章节、可执行的项目计划。`,
    prompt: [
      `项目信息：${JSON.stringify(input.projectInfo)}`,
      `创意总结：${JSON.stringify(input.concept)}`,
      `来源灵感：${JSON.stringify(input.collectedIdeas)}`,
      "所有章节都应具体；执行步骤必须包含目标、任务、交付物和依赖；不得声称尚未进行的测试已经完成。",
      "sourceNodeIds 必须且只能使用来源灵感 id。",
    ].join("\n"),
  };
}

export function imagePromptPrompt(input: PromptInput): {
  system: string;
  prompt: string;
} {
  return {
    system: `${JSON_ONLY_SYSTEM}\n你负责生成可直接用于图像模型的中英文提示词，但不得声称已经生成图片。`,
    prompt: [
      `项目信息：${JSON.stringify(input.projectInfo)}`,
      `项目计划：${JSON.stringify(input.plan)}`,
      `要设计的物品（必须作为画面主体）：${input.projectInfo.designObject}`,
      `用户指定背景：${{ white: "纯白无缝背景", studio: "有层次的影棚背景", scene: "与项目匹配的具体场景背景" }[input.backgroundChoice]}`,
      `用户指定人物模特：${input.modelChoice === "required" ? "必须包含人物模特并描述其身份、姿态和服装" : "不需要人物模特，画面中不得出现人物"}`,
      `用户指定物品视角：${{ front: "正视", side: "侧视", top: "俯视", low: "仰视", "three-quarter": "45° 三分之四视角", detail: "局部细节特写", isometric: "等距视图" }[input.viewpointChoice]}`,
      "中英文提示词需语义一致，并明确主体、风格、构图、材质、色彩、光线、镜头、背景和负面提示。",
      "background 必须明确选择纯白/纯色背景、影棚背景或具体环境背景；modelDirection 必须明确“无需人物模特”或描述需要的模特人数、身份、姿态与服装；viewpoint 必须严格采用用户指定的物品视角，禁止含糊表述。",
      "sourceIdeas 和 sourceNodeIds 只能来自项目计划。",
    ].join("\n"),
  };
}

export function imageAnalysisInstruction(name: string): string {
  return [
    `分析图片素材“${name}”。`,
    "先客观描述可见主体、形态、构图、材质、色彩、光线和氛围；不确定的信息要明确保留。",
    "再生成恰好 10 个互不重复、可继续用于设计发散的中文灵感词。",
    "每个词填写 category、reason、visualHint 和 0 到 1 的 relevance。",
    "不要识别或推断现实人物身份，不要编造图片外信息。",
  ].join("\n");
}
