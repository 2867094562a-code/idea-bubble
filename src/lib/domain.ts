export type AIProviderId = "openai" | "google" | "deepseek" | "mimo" | "openai-compatible" | "mock";

export type AITask = "expand" | "summary" | "plan" | "prompt" | "vision";

export type AIModelSettings = Record<AITask, string>;

export type ProjectType =
  "鞋类设计" | "产品设计" | "品牌设计" | "平面视觉" | "视频创意" | "通用头脑风暴" | "自定义";

export type AssetKind = "image" | "video" | "gif";
export type AssetStatus = "ready" | "analyzing" | "analyzed" | "unsupported" | "error";

export interface AIProviderConfig {
  provider: AIProviderId;
  apiKey: string;
  baseURL: string;
  models: AIModelSettings;
}

/** Only the model needed for the current request is sent to the selected AI provider. */
export interface AIRequestConfig {
  provider: AIProviderId;
  model?: string;
  baseURL?: string;
}

export interface ProjectInfo {
  name: string;
  type: ProjectType;
  customType?: string;
  goal: string;
  audience: string;
  scenario: string;
  requirements: string;
  forbiddenElements: string;
}

export interface Asset {
  id: string;
  kind: AssetKind;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  status: AssetStatus;
  analysis?: string;
  createdAt: string;
}

export interface InspirationIdea {
  word: string;
  category: string;
  reason: string;
  visualHint: string;
  relevance: number;
}

export interface InspirationNode extends InspirationIdea {
  id: string;
  parentId?: string;
  sourceAssetId?: string;
  position: { x: number; y: number };
  depth: number;
  collected: boolean;
  locked: boolean;
  collapsed: boolean;
  createdAt: string;
}

export interface InspirationEdge {
  id: string;
  source: string;
  target: string;
}

export interface ConceptSummary {
  title: string;
  summary: string;
  keywords: string[];
  conflicts: string[];
  questions: string[];
  sourceNodeIds: string[];
}

export interface ConceptVersion {
  id: string;
  name: string;
  data: ConceptSummary;
  createdAt: string;
}

export interface ExecutionStep {
  stage: string;
  objective: string;
  tasks: string[];
  deliverables: string[];
  estimatedDependencies: string[];
}

export interface ProjectPlan {
  projectName: string;
  subtitle: string;
  oneLineConcept: string;
  executiveSummary: string;
  background: string;
  problemDefinition: string;
  targetAudience: string[];
  usageScenarios: string[];
  projectGoals: string[];
  coreIdeas: string[];
  designDirection: string[];
  visualDirection: string[];
  functionalDirection: string[];
  materialsOrResources: string[];
  colorDirection: string[];
  executionSteps: ExecutionStep[];
  risks: string[];
  validationMethods: string[];
  nextActions: string[];
  sourceNodeIds: string[];
}

export interface ProjectPlanVersion {
  id: string;
  name: string;
  data: ProjectPlan;
  createdAt: string;
  isFinal: boolean;
}

export interface ImagePrompt {
  promptCN: string;
  promptEN: string;
  subject: string;
  style: string;
  composition: string;
  materials: string[];
  colorPalette: string[];
  lighting: string;
  camera: string;
  negativePrompt: string[];
  sourceIdeas: string[];
  sourceNodeIds: string[];
}

export interface ImagePromptVersion {
  id: string;
  name: string;
  data: ImagePrompt;
  createdAt: string;
}

export type ExportFormat = "docx" | "pdf" | "txt" | "markdown" | "json";
export type ExportSectionId =
  | "cover"
  | "projectInfo"
  | "originalInput"
  | "assets"
  | "allIdeas"
  | "relationships"
  | "collectedIdeas"
  | "concept"
  | "plan"
  | "execution"
  | "risks"
  | "imagePrompt"
  | "version"
  | "exportedAt";

export interface ExportPreset {
  id: string;
  name: string;
  formats: ExportFormat[];
  includedSections: ExportSectionId[];
  layout: "minimal" | "business" | "creative" | "school" | "plain";
  orientation: "portrait" | "landscape";
  includeCover: boolean;
  includeTableOfContents: boolean;
  includeHeader: boolean;
  includeFooter: boolean;
  includePageNumbers: boolean;
  includeAssets: boolean;
  includeSourceIdeas: boolean;
  includeImagePrompt: boolean;
  customRequirements: string;
  coverTitle?: string;
  subtitle?: string;
  author?: string;
  organization?: string;
  versionName?: string;
  fileName?: string;
}

export interface ExportFileResult {
  format: ExportFormat;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface ExportJob {
  id: string;
  projectId: string;
  formats: ExportFormat[];
  status: "idle" | "preparing" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  files: ExportFileResult[];
  errors: Partial<Record<ExportFormat, string>>;
  createdAt: string;
  completedAt?: string;
}

export interface AIRequestLog {
  id: string;
  task: "expand" | "summarize" | "plan" | "prompt" | "vision" | "media";
  provider: AIProviderId;
  status: "success" | "error";
  durationMs: number;
  createdAt: string;
}

export interface Project {
  id: string;
  info: ProjectInfo;
  originalInputs: string[];
  assets: Asset[];
  nodes: InspirationNode[];
  edges: InspirationEdge[];
  currentConcept?: ConceptSummary;
  conceptVersions: ConceptVersion[];
  currentPlan?: ProjectPlan;
  planVersions: ProjectPlanVersion[];
  imagePromptVersions: ImagePromptVersion[];
  exportPresets: ExportPreset[];
  exportJobs: ExportJob[];
  aiRequestLogs: AIRequestLog[];
  createdAt: string;
  updatedAt: string;
}

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";
export type WorkspaceStage = "canvas" | "concept" | "plan";
