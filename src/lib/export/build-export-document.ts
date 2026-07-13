import type {
  Asset,
  ExportPreset,
  ExportSectionId,
  ImagePrompt,
  InspirationNode,
  Project,
  ProjectPlan,
  ProjectPlanVersion,
} from "@/lib/domain";
import { createImageJsonPrompt } from "@/lib/image-prompt-format";

import type { ExportAsset, ExportBlock, ExportDocument, ExportIdea, ExportSection } from "./types";

const SECTION_TITLES: Record<Exclude<ExportSectionId, "cover">, string> = {
  projectInfo: "项目基本信息",
  originalInput: "原始输入内容",
  assets: "项目素材",
  allIdeas: "灵感气泡列表",
  relationships: "灵感关系说明",
  collectedIdeas: "已收集灵感",
  concept: "创意总结",
  plan: "完整项目计划",
  execution: "执行步骤",
  risks: "风险与验证方式",
  imagePrompt: "AI 生图提示词",
  version: "版本信息",
  exportedAt: "导出信息",
};

const SOURCE_SECTION_IDS = new Set<ExportSectionId>(["allIdeas", "relationships", "collectedIdeas"]);

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanList(values: readonly unknown[] | undefined): string[] {
  if (!values) return [];
  return values.map(cleanText).filter(Boolean);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return cleanText(value);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function paragraph(label: string, text: unknown): ExportBlock | undefined {
  const normalized = cleanText(text);
  return normalized ? { kind: "paragraph", label, text: normalized } : undefined;
}

function list(
  label: string,
  items: readonly unknown[] | undefined,
  ordered = false,
): ExportBlock | undefined {
  const normalized = cleanList(items);
  return normalized.length ? { kind: "list", label, items: normalized, ordered } : undefined;
}

function keyValues(
  label: string | undefined,
  rows: Array<{ label: string; value: unknown }>,
): ExportBlock | undefined {
  const normalized = rows
    .map((row) => ({ label: cleanText(row.label), value: cleanText(row.value) }))
    .filter((row) => row.label && row.value);
  return normalized.length ? { kind: "keyValue", label, rows: normalized } : undefined;
}

function compactBlocks(blocks: Array<ExportBlock | undefined>): ExportBlock[] {
  return blocks.filter((block): block is ExportBlock => Boolean(block));
}

function latestByCreatedAt<T extends { createdAt: string }>(items: readonly T[]): T | undefined {
  return [...items].sort((a, b) => {
    const aTime = Date.parse(a.createdAt) || 0;
    const bTime = Date.parse(b.createdAt) || 0;
    return bTime - aTime;
  })[0];
}

function latestPlanVersion(project: Project): ProjectPlanVersion | undefined {
  const finalVersions = project.planVersions.filter((version) => version.isFinal);
  return latestByCreatedAt(finalVersions.length ? finalVersions : project.planVersions);
}

function currentPlan(project: Project): ProjectPlan | undefined {
  return project.currentPlan ?? latestPlanVersion(project)?.data;
}

function currentPrompt(project: Project): ImagePrompt | undefined {
  return latestByCreatedAt(project.imagePromptVersions)?.data;
}

function normalizeAsset(asset: Asset): ExportAsset {
  return {
    name: cleanText(asset.name) || "未命名素材",
    kind: asset.kind,
    mimeType: cleanText(asset.mimeType) || "application/octet-stream",
    size: Number.isFinite(asset.size) && asset.size > 0 ? asset.size : 0,
    description: cleanText(asset.analysis) || undefined,
    dataUrl: cleanText(asset.dataUrl) || undefined,
  };
}

function normalizeIdea(node: InspirationNode, assets: Map<string, Asset>): ExportIdea {
  return {
    word: cleanText(node.word),
    category: cleanText(node.category),
    reason: cleanText(node.reason),
    visualHint: cleanText(node.visualHint),
    relevance: Math.max(0, Math.min(1, Number.isFinite(node.relevance) ? node.relevance : 0)),
    collected: Boolean(node.collected),
    depth: Math.max(0, Number.isFinite(node.depth) ? Math.round(node.depth) : 0),
    sourceAssetName: node.sourceAssetId
      ? cleanText(assets.get(node.sourceAssetId)?.name) || undefined
      : undefined,
  };
}

function projectInfoSection(project: Project): ExportSection | undefined {
  const customType = project.info.type === "自定义" ? cleanText(project.info.customType) : "";
  const block = keyValues(undefined, [
    { label: "项目名称", value: project.info.name },
    { label: "项目类型", value: customType || project.info.type },
    { label: "项目目标", value: project.info.goal },
    { label: "目标人群", value: project.info.audience },
    { label: "使用场景", value: project.info.scenario },
    { label: "限制与要求", value: project.info.requirements },
    { label: "禁止元素", value: project.info.forbiddenElements },
  ]);
  return block ? { id: "projectInfo", title: SECTION_TITLES.projectInfo, blocks: [block] } : undefined;
}

function originalInputSection(project: Project): ExportSection | undefined {
  const items = cleanList(project.originalInputs);
  return items.length
    ? {
        id: "originalInput",
        title: SECTION_TITLES.originalInput,
        blocks: [{ kind: "list", items, ordered: true }],
      }
    : undefined;
}

function assetsSection(assets: ExportAsset[]): ExportSection | undefined {
  if (!assets.length) return undefined;
  const galleryAssets = assets.filter((asset) => asset.kind === "image" || asset.kind === "gif");
  return {
    id: "assets",
    title: SECTION_TITLES.assets,
    blocks: compactBlocks([
      {
        kind: "table",
        columns: ["名称", "类型", "文件格式", "大小"],
        rows: assets.map((asset) => [
          asset.name,
          asset.kind === "image" ? "图片" : asset.kind === "video" ? "视频" : "动图",
          asset.mimeType,
          formatBytes(asset.size),
        ]),
      },
      galleryAssets.length ? { kind: "assetGallery", label: "素材预览", assets: galleryAssets } : undefined,
    ]),
  };
}

function ideasSection(id: "allIdeas" | "collectedIdeas", ideas: ExportIdea[]): ExportSection | undefined {
  const selected = id === "collectedIdeas" ? ideas.filter((idea) => idea.collected) : ideas;
  if (!selected.length) return undefined;
  return {
    id,
    title: SECTION_TITLES[id],
    blocks: [
      {
        kind: "table",
        columns: ["灵感词", "分类", "关联原因", "视觉提示", "相关度"],
        rows: selected.map((idea) => [
          idea.word,
          idea.category,
          idea.reason,
          idea.visualHint,
          `${Math.round(idea.relevance * 100)}%`,
        ]),
      },
    ],
  };
}

function relationshipsSection(project: Project): ExportSection | undefined {
  const names = new Map(project.nodes.map((node) => [node.id, cleanText(node.word)]));
  const rows = project.edges
    .map((edge) => [names.get(edge.source) ?? "", names.get(edge.target) ?? ""])
    .filter((row) => row[0] && row[1]);
  if (!rows.length) return undefined;
  return {
    id: "relationships",
    title: SECTION_TITLES.relationships,
    blocks: [{ kind: "table", columns: ["来源灵感", "衍生灵感"], rows }],
  };
}

function conceptSection(project: Project): ExportSection | undefined {
  const concept = project.currentConcept ?? latestByCreatedAt(project.conceptVersions)?.data;
  if (!concept) return undefined;
  const blocks = compactBlocks([
    paragraph("创意标题", concept.title),
    paragraph("创意概述", concept.summary),
    list("关键词", concept.keywords),
    list("潜在冲突", concept.conflicts),
    list("待确认问题", concept.questions),
  ]);
  return blocks.length ? { id: "concept", title: SECTION_TITLES.concept, blocks } : undefined;
}

function planSection(plan: ProjectPlan | undefined): ExportSection | undefined {
  if (!plan) return undefined;
  const blocks = compactBlocks([
    paragraph("一句话概念", plan.oneLineConcept),
    paragraph("执行摘要", plan.executiveSummary),
    paragraph("项目背景", plan.background),
    paragraph("问题定义", plan.problemDefinition),
    list("目标人群", plan.targetAudience),
    list("使用场景", plan.usageScenarios),
    list("项目目标", plan.projectGoals),
    list("核心创意", plan.coreIdeas),
    list("设计方向", plan.designDirection),
    list("视觉方向", plan.visualDirection),
    list("功能方向", plan.functionalDirection),
    list("材料与资源", plan.materialsOrResources),
    list("色彩方向", plan.colorDirection),
    list("下一步行动", plan.nextActions, true),
  ]);
  return blocks.length ? { id: "plan", title: SECTION_TITLES.plan, blocks } : undefined;
}

function executionSection(plan: ProjectPlan | undefined): ExportSection | undefined {
  if (!plan) return undefined;
  const blocks = plan.executionSteps.flatMap<ExportBlock>((step, index) => {
    const stage = cleanText(step.stage) || `阶段 ${index + 1}`;
    const rows = [
      { label: "目标", value: cleanText(step.objective) },
      { label: "任务", value: cleanList(step.tasks).join("\n") },
      { label: "交付物", value: cleanList(step.deliverables).join("\n") },
      { label: "依赖", value: cleanList(step.estimatedDependencies).join("\n") },
    ].filter((row) => row.value);
    if (!rows.length) return [];
    return [
      {
        kind: "table",
        label: `${index + 1}. ${stage}`,
        columns: ["项目", "内容"],
        rows: rows.map((row) => [row.label, row.value]),
      },
    ];
  });
  return blocks.length ? { id: "execution", title: SECTION_TITLES.execution, blocks } : undefined;
}

function risksSection(plan: ProjectPlan | undefined): ExportSection | undefined {
  if (!plan) return undefined;
  const blocks = compactBlocks([
    list("主要风险", plan.risks),
    list("验证方式", plan.validationMethods, true),
  ]);
  return blocks.length ? { id: "risks", title: SECTION_TITLES.risks, blocks } : undefined;
}

function imagePromptSection(prompt: ImagePrompt | undefined): ExportSection | undefined {
  if (!prompt) return undefined;
  const blocks = compactBlocks([
    paragraph("中文提示词", prompt.promptCN),
    paragraph("English Prompt", prompt.promptEN),
    paragraph("JSON Prompt", prompt.jsonPrompt ?? createImageJsonPrompt(prompt)),
    keyValues("画面设置", [
      { label: "主体", value: prompt.subject },
      { label: "风格", value: prompt.style },
      { label: "构图", value: prompt.composition },
      { label: "光线", value: prompt.lighting },
      { label: "镜头", value: prompt.camera },
      { label: "背景", value: prompt.background },
      { label: "人物模特", value: prompt.modelDirection },
      { label: "物品视角", value: prompt.viewpoint },
    ]),
    list("材质", prompt.materials),
    list("配色", prompt.colorPalette),
    list("负面提示词", prompt.negativePrompt),
    list("来源灵感", prompt.sourceIdeas),
  ]);
  return blocks.length ? { id: "imagePrompt", title: SECTION_TITLES.imagePrompt, blocks } : undefined;
}

function versionSection(project: Project, preset: ExportPreset): ExportSection | undefined {
  const planVersion = latestPlanVersion(project);
  const versionName = cleanText(preset.versionName) || cleanText(planVersion?.name);
  const block = keyValues(undefined, [
    { label: "版本名称", value: versionName },
    { label: "项目创建时间", value: formatDate(project.createdAt) },
    { label: "项目更新时间", value: formatDate(project.updatedAt) },
  ]);
  return block ? { id: "version", title: SECTION_TITLES.version, blocks: [block] } : undefined;
}

function exportedAtSection(exportedAt: string): ExportSection {
  return {
    id: "exportedAt",
    title: SECTION_TITLES.exportedAt,
    blocks: [{ kind: "paragraph", label: "导出时间", text: formatDate(exportedAt) }],
  };
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

/**
 * Builds a deterministic, presentation-ready snapshot without mutating project
 * state. API callers pass an explicit timestamp; omitted timestamps fall back to
 * the project's update time so direct calls remain deterministic.
 */
export function buildExportDocument(
  project: Project,
  preset: ExportPreset,
  exportedAt = project.updatedAt || project.createdAt,
): ExportDocument {
  const assetMap = new Map(project.assets.map((asset) => [asset.id, asset]));
  const assets = project.assets.map(normalizeAsset);
  const sourceIdeas = project.nodes.map((node) => normalizeIdea(node, assetMap));
  const plan = currentPlan(project);
  const prompt = currentPrompt(project);

  const factories: Record<Exclude<ExportSectionId, "cover">, () => ExportSection | undefined> = {
    projectInfo: () => projectInfoSection(project),
    originalInput: () => originalInputSection(project),
    assets: () => assetsSection(assets),
    allIdeas: () => ideasSection("allIdeas", sourceIdeas),
    relationships: () => relationshipsSection(project),
    collectedIdeas: () => ideasSection("collectedIdeas", sourceIdeas),
    concept: () => conceptSection(project),
    plan: () => planSection(plan),
    execution: () => executionSection(plan),
    risks: () => risksSection(plan),
    imagePrompt: () => imagePromptSection(prompt),
    version: () => versionSection(project, preset),
    exportedAt: () => exportedAtSection(exportedAt),
  };

  const seen = new Set<ExportSectionId>();
  const sections: ExportSection[] = [];
  for (const id of preset.includedSections) {
    if (id === "cover" || seen.has(id)) continue;
    seen.add(id);
    if (id === "assets" && !preset.includeAssets) continue;
    if (SOURCE_SECTION_IDS.has(id) && !preset.includeSourceIdeas) continue;
    if (id === "imagePrompt" && !preset.includeImagePrompt) continue;
    const section = factories[id]();
    if (section?.blocks.length) sections.push(section);
  }

  const versionName =
    cleanText(preset.versionName) || cleanText(latestPlanVersion(project)?.name) || undefined;
  const subtitle = cleanText(preset.subtitle) || cleanText(plan?.subtitle) || undefined;
  const title =
    cleanText(preset.coverTitle) ||
    cleanText(plan?.projectName) ||
    cleanText(project.info.name) ||
    "项目计划";
  const includeCover = preset.includeCover && preset.includedSections.includes("cover");

  return {
    metadata: {
      projectId: project.id,
      projectName: cleanText(project.info.name) || title,
      subtitle,
      author: cleanText(preset.author) || undefined,
      organization: cleanText(preset.organization) || undefined,
      versionName,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      exportedAt,
    },
    cover: includeCover
      ? {
          title,
          subtitle,
          author: cleanText(preset.author) || undefined,
          organization: cleanText(preset.organization) || undefined,
          versionName,
          date: formatDate(exportedAt),
        }
      : undefined,
    sections,
    assets: preset.includeAssets ? assets : [],
    sourceIdeas: preset.includeSourceIdeas && sourceIdeas.length ? sourceIdeas : undefined,
    options: {
      layout: preset.layout,
      orientation: preset.orientation,
      includeTableOfContents: preset.includeTableOfContents,
      includeHeader: preset.includeHeader,
      includeFooter: preset.includeFooter,
      includePageNumbers: preset.includePageNumbers,
      customRequirements: cleanText(preset.customRequirements) || undefined,
    },
  };
}

export { SECTION_TITLES };
