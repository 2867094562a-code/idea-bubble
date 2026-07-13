import type { ExportPreset, Project, ProjectInfo } from "@/lib/domain";

export const DEFAULT_COLLECTION_THRESHOLD = 5;
export const MAX_PROJECT_NODES = 200;

export const DEFAULT_EXPORT_SECTIONS = [
  "cover",
  "projectInfo",
  "concept",
  "plan",
  "execution",
  "risks",
  "version",
  "exportedAt",
] as const;

export function createDefaultExportPreset(): ExportPreset {
  return {
    id: crypto.randomUUID(),
    name: "正式项目报告",
    formats: ["docx", "pdf", "txt"],
    includedSections: [...DEFAULT_EXPORT_SECTIONS],
    layout: "business",
    orientation: "portrait",
    includeCover: true,
    includeTableOfContents: true,
    includeHeader: true,
    includeFooter: true,
    includePageNumbers: true,
    includeAssets: false,
    includeSourceIdeas: false,
    includeImagePrompt: false,
    customRequirements: "",
    versionName: "v1",
  };
}

export function createProject(info?: Partial<ProjectInfo>): Project {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    info: {
      name: info?.name || "未命名灵感项目",
      designObject: info?.designObject || "",
      type: info?.type || "通用头脑风暴",
      customType: info?.customType || "",
      goal: info?.goal || "",
      audience: info?.audience || "",
      scenario: info?.scenario || "",
      requirements: info?.requirements || "",
      forbiddenElements: info?.forbiddenElements || "",
    },
    originalInputs: [],
    assets: [],
    nodes: [],
    edges: [],
    conceptVersions: [],
    planVersions: [],
    imagePromptVersions: [],
    exportPresets: [createDefaultExportPreset()],
    exportJobs: [],
    aiRequestLogs: [],
    createdAt: now,
    updatedAt: now,
  };
}
