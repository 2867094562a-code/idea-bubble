"use client";

import { create } from "zustand";
import { createProject, DEFAULT_COLLECTION_THRESHOLD, MAX_PROJECT_NODES } from "@/lib/defaults";
import type {
  AIProviderConfig,
  Asset,
  ConceptSummary,
  ExportPreset,
  ImagePrompt,
  InspirationIdea,
  InspirationNode,
  Project,
  ProjectInfo,
  ProjectPlan,
  SaveStatus,
  WorkspaceStage,
} from "@/lib/domain";
import {
  clearLocalAIConfig,
  createDefaultAIConfig,
  readLocalAIConfig,
  writeLocalAIConfig,
} from "@/lib/client-ai-config";
import { normalizeIdeaWord } from "@/lib/idea-normalization";
import { projectRepository, readCollectionThreshold, writeCollectionThreshold } from "@/lib/repository";

const HISTORY_LIMIT = 30;
const BUBBLE_GAP = 32;
const MAX_LAYOUT_RINGS = 14;
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingProjects = new Map<string, Project>();

function cloneProject(project: Project): Project {
  return structuredClone(project);
}

function bubbleDiameter(node: Pick<InspirationNode, "depth" | "relevance">): number {
  return node.depth === 0 ? 148 : Math.round(96 + node.relevance * 28);
}

interface OccupiedBubble {
  x: number;
  y: number;
  diameter: number;
}

function placeBubble(
  parent: InspirationNode,
  targetAngle: number,
  diameter: number,
  initialRadius: number,
  occupied: OccupiedBubble[],
): { x: number; y: number } {
  const parentDiameter = bubbleDiameter(parent);
  const parentCenter = {
    x: parent.position.x + parentDiameter / 2,
    y: parent.position.y + parentDiameter / 2,
  };
  const offsets = [0, 0.16, -0.16, 0.32, -0.32, 0.5, -0.5, 0.7, -0.7, 0.92, -0.92];

  for (let ring = 0; ring < MAX_LAYOUT_RINGS; ring += 1) {
    const radius = initialRadius + ring * 92;
    for (const offset of offsets) {
      const angle = targetAngle + offset;
      const center = {
        x: parentCenter.x + Math.cos(angle) * radius,
        y: parentCenter.y + Math.sin(angle) * radius,
      };
      const collides = occupied.some((item) => {
        const minimumDistance = (diameter + item.diameter) / 2 + BUBBLE_GAP;
        return Math.hypot(center.x - item.x, center.y - item.y) < minimumDistance;
      });
      if (!collides) return { x: center.x - diameter / 2, y: center.y - diameter / 2 };
    }
  }

  // This only occurs on a deliberately very dense canvas. Keep expanding outward
  // rather than placing a new bubble on top of an existing one.
  const fallbackRadius = initialRadius + MAX_LAYOUT_RINGS * 92;
  return {
    x: parentCenter.x + Math.cos(targetAngle) * fallbackRadius - diameter / 2,
    y: parentCenter.y + Math.sin(targetAngle) * fallbackRadius - diameter / 2,
  };
}

type PlanTextField = Exclude<
  keyof ProjectPlan,
  | "targetAudience"
  | "usageScenarios"
  | "projectGoals"
  | "coreIdeas"
  | "designDirection"
  | "visualDirection"
  | "functionalDirection"
  | "materialsOrResources"
  | "colorDirection"
  | "executionSteps"
  | "risks"
  | "validationMethods"
  | "nextActions"
  | "sourceNodeIds"
>;

type PlanListField = Extract<
  keyof ProjectPlan,
  | "targetAudience"
  | "usageScenarios"
  | "projectGoals"
  | "coreIdeas"
  | "designDirection"
  | "visualDirection"
  | "functionalDirection"
  | "materialsOrResources"
  | "colorDirection"
  | "risks"
  | "validationMethods"
  | "nextActions"
>;

interface IdeaStore {
  project?: Project;
  selectedNodeId?: string;
  aiConfig: AIProviderConfig;
  stage: WorkspaceStage;
  saveStatus: SaveStatus;
  hydrated: boolean;
  collectionThreshold: number;
  busyTask?: "expand" | "summarize" | "plan" | "prompt" | "vision";
  aiProgress: number;
  error?: string;
  past: Project[];
  future: Project[];

  hydrate: () => Promise<void>;
  createNewProject: (info: ProjectInfo) => void;
  loadProject: (project: Project) => void;
  deleteProject: (id: string) => Promise<void>;
  updateProjectInfo: (patch: Partial<ProjectInfo>) => void;
  setAIConfig: (config: AIProviderConfig) => void;
  clearAIConfig: () => void;
  setStage: (stage: WorkspaceStage) => void;
  setBusyTask: (task?: IdeaStore["busyTask"]) => void;
  setAIProgress: (value: number) => void;
  setError: (error?: string) => void;
  setSelectedNode: (id?: string) => void;
  setCollectionThreshold: (value: number) => void;
  addExpansion: (
    source: string,
    parentId: string | undefined,
    sourceAssetId: string | undefined,
    ideas: InspirationIdea[],
  ) => void;
  updateNode: (id: string, patch: Partial<InspirationIdea>) => void;
  moveNode: (id: string, position: { x: number; y: number }) => void;
  toggleCollect: (id: string) => void;
  clearCollection: () => void;
  toggleLock: (id: string) => void;
  toggleCollapse: (id: string) => void;
  deleteNode: (id: string, branch?: boolean) => void;
  reorganizeNodes: () => void;
  addAsset: (asset: Asset) => void;
  updateAsset: (id: string, patch: Partial<Asset>) => void;
  removeAsset: (id: string) => void;
  setConcept: (concept: ConceptSummary) => void;
  updateConcept: (patch: Partial<ConceptSummary>) => void;
  saveConceptVersion: (name?: string) => void;
  setPlan: (plan: ProjectPlan) => void;
  updatePlanText: (field: PlanTextField, value: string) => void;
  updatePlanList: (field: PlanListField, value: string[]) => void;
  updateExecutionStep: (index: number, patch: Partial<ProjectPlan["executionSteps"][number]>) => void;
  savePlanVersion: (name?: string) => void;
  restorePlanVersion: (id: string) => void;
  markFinalPlanVersion: (id: string) => void;
  saveImagePrompt: (prompt: ImagePrompt, name?: string) => void;
  saveExportPreset: (preset: ExportPreset) => void;
  undo: () => void;
  redo: () => void;
  saveNow: () => Promise<void>;
}

async function persistPendingProject(projectId: string, setStatus: (status: SaveStatus) => void) {
  const project = pendingProjects.get(projectId);
  if (!project) return;
  pendingProjects.delete(projectId);
  const timer = saveTimers.get(projectId);
  if (timer) clearTimeout(timer);
  saveTimers.delete(projectId);
  try {
    setStatus("saving");
    await projectRepository.save(project);
    setStatus("saved");
  } catch {
    pendingProjects.set(projectId, project);
    setStatus("error");
  }
}

function scheduleSave(project: Project, setStatus: (status: SaveStatus) => void, immediate = false) {
  const snapshot = cloneProject(project);
  pendingProjects.set(project.id, snapshot);
  const existing = saveTimers.get(project.id);
  if (existing) clearTimeout(existing);
  if (immediate) {
    void persistPendingProject(project.id, setStatus);
    return;
  }
  setStatus("dirty");
  const timer = setTimeout(() => {
    void persistPendingProject(project.id, setStatus);
  }, 650);
  saveTimers.set(project.id, timer);
}
export const useIdeaStore = create<IdeaStore>((set, get) => {
  const mutateProject = (
    mutator: (draft: Project) => void,
    recordHistory = true,
    saveImmediately = false,
  ) => {
    const current = get().project;
    if (!current) return;
    const previous = cloneProject(current);
    const next = cloneProject(current);
    mutator(next);
    next.updatedAt = new Date().toISOString();
    set((state) => ({
      project: next,
      past: recordHistory ? [...state.past.slice(-(HISTORY_LIMIT - 1)), previous] : state.past,
      future: recordHistory ? [] : state.future,
    }));
    scheduleSave(
      next,
      (saveStatus) => {
        if (get().project?.id === next.id) set({ saveStatus });
      },
      saveImmediately,
    );
  };

  return {
    aiConfig: createDefaultAIConfig(),
    stage: "canvas",
    saveStatus: "idle",
    hydrated: false,
    collectionThreshold: DEFAULT_COLLECTION_THRESHOLD,
    aiProgress: 0,
    past: [],
    future: [],

    hydrate: async () => {
      let aiConfig = createDefaultAIConfig();
      let configError: string | undefined;
      try {
        aiConfig = readLocalAIConfig();
      } catch {
        configError = "浏览器拒绝读取模型配置，已安全切换到 Mock。";
      }
      try {
        const project = await projectRepository.getLatest();
        set({
          project,
          hydrated: true,
          saveStatus: project ? "saved" : "idle",
          stage: project?.currentPlan ? "plan" : project?.currentConcept ? "concept" : "canvas",
          aiConfig,
          error: configError,
          collectionThreshold: readCollectionThreshold(DEFAULT_COLLECTION_THRESHOLD),
        });
      } catch {
        set({ aiConfig, error: configError, hydrated: true, saveStatus: "error" });
      }
    },

    createNewProject: (info) => {
      const project = createProject(info);
      set({
        project,
        selectedNodeId: undefined,
        stage: "canvas",
        past: [],
        future: [],
      });
      scheduleSave(project, (saveStatus) => set({ saveStatus }), true);
    },

    loadProject: (project) =>
      set({
        project: cloneProject(project),
        selectedNodeId: undefined,
        stage: project.currentPlan ? "plan" : project.currentConcept ? "concept" : "canvas",
        past: [],
        future: [],
        saveStatus: "saved",
      }),

    deleteProject: async (id) => {
      const timer = saveTimers.get(id);
      if (timer) clearTimeout(timer);
      saveTimers.delete(id);
      pendingProjects.delete(id);
      await projectRepository.delete(id);

      if (get().project?.id !== id) return;
      const next = await projectRepository.getLatest();
      set({
        project: next,
        selectedNodeId: undefined,
        stage: next?.currentPlan ? "plan" : next?.currentConcept ? "concept" : "canvas",
        past: [],
        future: [],
        saveStatus: next ? "saved" : "idle",
      });
    },

    updateProjectInfo: (patch) => mutateProject((project) => Object.assign(project.info, patch)),
    setAIConfig: (config) => {
      try {
        set({ aiConfig: writeLocalAIConfig(config) });
      } catch {
        set({ error: "浏览器拒绝保存模型配置，请检查隐私设置或本地存储空间。" });
      }
    },
    clearAIConfig: () => {
      try {
        set({ aiConfig: clearLocalAIConfig() });
      } catch {
        set({ error: "浏览器拒绝清除模型配置，请检查隐私设置后重试。" });
      }
    },
    setStage: (stage) => set({ stage }),
    setBusyTask: (busyTask) => set({ busyTask }),
    setAIProgress: (value) => set({ aiProgress: Math.min(100, Math.max(0, Math.round(value))) }),
    setError: (error) => set({ error }),
    setSelectedNode: (selectedNodeId) => set({ selectedNodeId }),
    setCollectionThreshold: (value) => {
      const collectionThreshold = Math.min(10, Math.max(3, Math.round(value)));
      writeCollectionThreshold(collectionThreshold);
      set({ collectionThreshold });
    },

    addExpansion: (source, parentId, sourceAssetId, ideas) =>
      mutateProject((project) => {
        const uniqueIdeas = ideas.filter(
          (idea, index, batch) =>
            batch.findIndex(
              (candidate) => normalizeIdeaWord(candidate.word) === normalizeIdeaWord(idea.word),
            ) === index &&
            !project.nodes.some((node) => normalizeIdeaWord(node.word) === normalizeIdeaWord(idea.word)),
        );
        const room = Math.max(0, MAX_PROJECT_NODES - project.nodes.length);
        const normalizedSource = normalizeIdeaWord(source);
        const canAddRoot =
          !parentId && !project.nodes.some((node) => normalizeIdeaWord(node.word) === normalizedSource);
        const needed = uniqueIdeas.length + (canAddRoot ? 1 : 0);
        if (needed > room) throw new Error(`单个项目最多支持 ${MAX_PROJECT_NODES} 个气泡`);

        let parent = parentId ? project.nodes.find((node) => node.id === parentId) : undefined;
        if (!parent) {
          parent = project.nodes.find((node) => normalizeIdeaWord(node.word) === normalizedSource);
        }
        if (!parent) {
          const rootId = crypto.randomUUID();
          parent = {
            id: rootId,
            word: source,
            category: "原始灵感",
            reason: sourceAssetId ? "来自上传素材的分析结果" : "用户输入的起始灵感",
            visualHint: "核心主题",
            relevance: 1,
            sourceAssetId,
            position: { x: 420, y: 260 },
            depth: 0,
            collected: false,
            locked: false,
            collapsed: false,
            createdAt: new Date().toISOString(),
          };
          project.nodes.push(parent);
          project.originalInputs.push(source);
        }

        const depth = parent.depth + 1;
        const grandparent = parent.parentId
          ? project.nodes.find((node) => node.id === parent?.parentId)
          : undefined;
        const existingChildCount = project.nodes.filter((node) => node.parentId === parent.id).length;
        const batchNumber = Math.floor(existingChildCount / 10);
        const baseRadius = depth === 1 ? 300 : Math.min(520, 300 + depth * 60);
        const radius = baseRadius + batchNumber * 110;
        const outwardAngle = grandparent
          ? Math.atan2(parent.position.y - grandparent.position.y, parent.position.x - grandparent.position.x)
          : -Math.PI / 2;
        const fanSpread = Math.PI * 1.5;
        const occupied: OccupiedBubble[] = project.nodes.map((node) => {
          const diameter = bubbleDiameter(node);
          return { x: node.position.x + diameter / 2, y: node.position.y + diameter / 2, diameter };
        });
        uniqueIdeas.forEach((idea, index) => {
          const angle =
            depth === 1
              ? (Math.PI * 2 * index) / uniqueIdeas.length - Math.PI / 2
              : outwardAngle - fanSpread / 2 + (fanSpread * index) / Math.max(1, uniqueIdeas.length - 1);
          const diameter = bubbleDiameter({ depth, relevance: idea.relevance });
          const position = placeBubble(parent!, angle, diameter, radius, occupied);
          const id = crypto.randomUUID();
          project.nodes.push({
            ...idea,
            id,
            parentId: parent!.id,
            sourceAssetId: sourceAssetId || parent!.sourceAssetId,
            position,
            depth,
            collected: false,
            locked: false,
            collapsed: false,
            createdAt: new Date().toISOString(),
          });
          occupied.push({ x: position.x + diameter / 2, y: position.y + diameter / 2, diameter });
          project.edges.push({ id: `${parent!.id}-${id}`, source: parent!.id, target: id });
        });
      }),

    updateNode: (id, patch) =>
      mutateProject((project) => {
        const node = project.nodes.find((candidate) => candidate.id === id);
        if (node) Object.assign(node, patch);
      }),

    moveNode: (id, position) =>
      mutateProject((project) => {
        const node = project.nodes.find((candidate) => candidate.id === id);
        if (node && !node.locked) node.position = position;
      }, false),

    toggleCollect: (id) =>
      mutateProject((project) => {
        const node = project.nodes.find((candidate) => candidate.id === id);
        if (node) node.collected = !node.collected;
      }),

    clearCollection: () =>
      mutateProject((project) => {
        project.nodes.forEach((node) => (node.collected = false));
      }),

    toggleLock: (id) =>
      mutateProject((project) => {
        const node = project.nodes.find((candidate) => candidate.id === id);
        if (node) node.locked = !node.locked;
      }),

    toggleCollapse: (id) =>
      mutateProject((project) => {
        const node = project.nodes.find((candidate) => candidate.id === id);
        if (node) node.collapsed = !node.collapsed;
      }),

    deleteNode: (id, branch = false) =>
      mutateProject((project) => {
        const ids = new Set([id]);
        if (branch) {
          let changed = true;
          while (changed) {
            changed = false;
            project.nodes.forEach((node) => {
              if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
                ids.add(node.id);
                changed = true;
              }
            });
          }
        }
        project.nodes = project.nodes.filter((node) => !ids.has(node.id));
        project.edges = project.edges.filter((edge) => !ids.has(edge.source) && !ids.has(edge.target));
      }),

    reorganizeNodes: () =>
      mutateProject((project) => {
        const levels = new Map<number, typeof project.nodes>();
        project.nodes.forEach((node) => {
          levels.set(node.depth, [...(levels.get(node.depth) || []), node]);
        });
        [...levels.entries()].forEach(([depth, nodes]) => {
          if (depth === 0) {
            nodes.forEach((node, index) => {
              if (!node.locked) node.position = { x: 420 + index * 180, y: 260 };
            });
            return;
          }
          nodes.forEach((node, index) => {
            if (!node.locked) {
              const columns = Math.ceil(Math.sqrt(nodes.length));
              node.position = {
                x: 120 + (index % columns) * 190,
                y: 80 + depth * 220 + Math.floor(index / columns) * 150,
              };
            }
          });
        });
      }),

    addAsset: (asset) => mutateProject((project) => project.assets.unshift(asset)),
    updateAsset: (id, patch) =>
      mutateProject((project) => {
        const asset = project.assets.find((candidate) => candidate.id === id);
        if (asset) Object.assign(asset, patch);
      }),
    removeAsset: (id) =>
      mutateProject((project) => {
        project.assets = project.assets.filter((asset) => asset.id !== id);
      }),

    setConcept: (currentConcept) =>
      mutateProject(
        (project) => {
          project.currentConcept = currentConcept;
        },
        true,
        true,
      ),
    updateConcept: (patch) =>
      mutateProject((project) => {
        if (project.currentConcept) Object.assign(project.currentConcept, patch);
      }),
    saveConceptVersion: (name) =>
      mutateProject((project) => {
        if (!project.currentConcept) return;
        project.conceptVersions.unshift({
          id: crypto.randomUUID(),
          name: name || `创意总结 v${project.conceptVersions.length + 1}`,
          data: structuredClone(project.currentConcept),
          createdAt: new Date().toISOString(),
        });
      }),

    setPlan: (currentPlan) =>
      mutateProject(
        (project) => {
          project.currentPlan = currentPlan;
        },
        true,
        true,
      ),
    updatePlanText: (field, value) =>
      mutateProject((project) => {
        if (project.currentPlan) project.currentPlan[field] = value;
      }),
    updatePlanList: (field, value) =>
      mutateProject((project) => {
        if (project.currentPlan) project.currentPlan[field] = value;
      }),
    updateExecutionStep: (index, patch) =>
      mutateProject((project) => {
        const step = project.currentPlan?.executionSteps[index];
        if (step) Object.assign(step, patch);
      }),
    savePlanVersion: (name) =>
      mutateProject((project) => {
        if (!project.currentPlan) return;
        project.planVersions.unshift({
          id: crypto.randomUUID(),
          name: name || `项目计划 v${project.planVersions.length + 1}`,
          data: structuredClone(project.currentPlan),
          createdAt: new Date().toISOString(),
          isFinal: false,
        });
      }),
    restorePlanVersion: (id) =>
      mutateProject((project) => {
        const version = project.planVersions.find((candidate) => candidate.id === id);
        if (version) project.currentPlan = structuredClone(version.data);
      }),
    markFinalPlanVersion: (id) =>
      mutateProject((project) => {
        project.planVersions.forEach((version) => (version.isFinal = version.id === id));
      }),
    saveImagePrompt: (prompt, name) =>
      mutateProject((project) => {
        project.imagePromptVersions.unshift({
          id: crypto.randomUUID(),
          name: name || `生图提示词 v${project.imagePromptVersions.length + 1}`,
          data: structuredClone(prompt),
          createdAt: new Date().toISOString(),
        });
      }),
    saveExportPreset: (preset) =>
      mutateProject((project) => {
        const index = project.exportPresets.findIndex((candidate) => candidate.id === preset.id);
        if (index >= 0) project.exportPresets[index] = structuredClone(preset);
        else project.exportPresets.unshift(structuredClone(preset));
      }),

    undo: () => {
      const { past, project, future } = get();
      if (!project || past.length === 0) return;
      const previous = cloneProject(past[past.length - 1]);
      set({
        project: previous,
        past: past.slice(0, -1),
        future: [cloneProject(project), ...future].slice(0, HISTORY_LIMIT),
      });
      scheduleSave(previous, (saveStatus) => set({ saveStatus }));
    },
    redo: () => {
      const { past, project, future } = get();
      if (!project || future.length === 0) return;
      const next = cloneProject(future[0]);
      set({
        project: next,
        past: [...past, cloneProject(project)].slice(-HISTORY_LIMIT),
        future: future.slice(1),
      });
      scheduleSave(next, (saveStatus) => set({ saveStatus }));
    },
    saveNow: async () => {
      const project = get().project;
      if (!project) return;
      const timer = saveTimers.get(project.id);
      if (timer) clearTimeout(timer);
      saveTimers.delete(project.id);
      pendingProjects.delete(project.id);
      try {
        set({ saveStatus: "saving" });
        await projectRepository.save(project);
        set({ saveStatus: "saved" });
      } catch {
        set({ saveStatus: "error" });
      }
    },
  };
});

export function selectCollectedNodes(project?: Project) {
  return project?.nodes.filter((node) => node.collected) || [];
}

export function canSummarize(project: Project | undefined, threshold: number) {
  return selectCollectedNodes(project).length >= threshold;
}
