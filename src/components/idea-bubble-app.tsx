"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Layers3, LoaderCircle, PanelLeft, PanelRight, X } from "lucide-react";
import { CollectionDock } from "@/components/collection/collection-dock";
import { ConceptEditor } from "@/components/concept/concept-editor";
import { ExportDialog } from "@/components/export/export-dialog";
import { InspirationCanvas } from "@/components/canvas/inspiration-canvas";
import { NodeDetails } from "@/components/canvas/node-details";
import { PlanEditor } from "@/components/plan/plan-editor";
import { ProjectHistory } from "@/components/project/project-history";
import { ProjectWizard } from "@/components/project/project-wizard";
import { LeftSidebar } from "@/components/shell/left-sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { WorkflowPanel } from "@/components/shell/workflow-panel";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { MAX_PROJECT_NODES } from "@/lib/defaults";
import type { ProjectInfo, ProviderStatus, WorkspaceStage } from "@/lib/domain";
import { parseApiData, postJson } from "@/lib/api-client";
import {
  conceptSummarySchema,
  expansionResultSchema,
  imagePromptSchema,
  projectPlanSchema,
} from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { selectCollectedNodes, useIdeaStore } from "@/store/idea-store";

type SummaryTone = "default" | "concise" | "professional" | "bold" | "commercial" | "visual";
type BusyTask = "expand" | "summarize" | "plan" | "prompt" | "vision";

interface ActiveRequest {
  token: symbol;
  task: BusyTask;
  projectId: string;
  controller: AbortController;
}

export function IdeaBubbleApp() {
  const project = useIdeaStore((state) => state.project);
  const hydrated = useIdeaStore((state) => state.hydrated);
  const hydrate = useIdeaStore((state) => state.hydrate);
  const createNewProject = useIdeaStore((state) => state.createNewProject);
  const stage = useIdeaStore((state) => state.stage);
  const setStage = useIdeaStore((state) => state.setStage);
  const provider = useIdeaStore((state) => state.provider);
  const setProvider = useIdeaStore((state) => state.setProvider);
  const providerStatus = useIdeaStore((state) => state.providerStatus);
  const setProviderStatus = useIdeaStore((state) => state.setProviderStatus);
  const saveStatus = useIdeaStore((state) => state.saveStatus);
  const past = useIdeaStore((state) => state.past);
  const future = useIdeaStore((state) => state.future);
  const undo = useIdeaStore((state) => state.undo);
  const redo = useIdeaStore((state) => state.redo);
  const saveNow = useIdeaStore((state) => state.saveNow);
  const addExpansion = useIdeaStore((state) => state.addExpansion);
  const setBusyTask = useIdeaStore((state) => state.setBusyTask);
  const setConcept = useIdeaStore((state) => state.setConcept);
  const setPlan = useIdeaStore((state) => state.setPlan);
  const saveImagePrompt = useIdeaStore((state) => state.saveImagePrompt);
  const error = useIdeaStore((state) => state.error);
  const setError = useIdeaStore((state) => state.setError);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const activeRequestRef = useRef<ActiveRequest | undefined>(undefined);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  useEffect(() => {
    fetch("/api/ai/status")
      .then((response) => response.json())
      .then((payload: { data?: ProviderStatus }) => {
        if (!payload.data) return;
        setProviderStatus(payload.data);
        if (!window.localStorage.getItem("idea-bubble:provider")) {
          useIdeaStore.setState({ provider: payload.data.configuredProvider });
        }
      })
      .catch(() => undefined);
  }, [setProviderStatus]);

  const beginRequest = useCallback(
    (task: BusyTask, projectId: string): ActiveRequest | undefined => {
      if (activeRequestRef.current || useIdeaStore.getState().busyTask) return undefined;
      const request: ActiveRequest = {
        token: Symbol(task),
        task,
        projectId,
        controller: new AbortController(),
      };
      activeRequestRef.current = request;
      setBusyTask(task);
      setError(undefined);
      return request;
    },
    [setBusyTask, setError],
  );

  const requestIsCurrent = useCallback(
    (request: ActiveRequest) =>
      activeRequestRef.current?.token === request.token &&
      useIdeaStore.getState().project?.id === request.projectId,
    [],
  );

  const finishRequest = useCallback(
    (request: ActiveRequest) => {
      if (activeRequestRef.current?.token !== request.token) return;
      activeRequestRef.current = undefined;
      setBusyTask(undefined);
    },
    [setBusyTask],
  );

  const cancelActiveRequest = useCallback(() => {
    const request = activeRequestRef.current;
    if (!request) return;
    activeRequestRef.current = undefined;
    request.controller.abort();
    setBusyTask(undefined);
  }, [setBusyTask]);

  useEffect(() => () => cancelActiveRequest(), [cancelActiveRequest]);

  const expand = useCallback(
    async (source: string, parentId?: string, sourceAssetId?: string) => {
      const current = useIdeaStore.getState().project;
      if (!current) return;
      const neededNodes =
        parentId || current.nodes.some((node) => node.word.trim() === source.trim()) ? 10 : 11;
      if (current.nodes.length + neededNodes > MAX_PROJECT_NODES) {
        setError(`气泡数量已接近 ${MAX_PROJECT_NODES} 个上限，请先整理或删除分支。`);
        return;
      }
      const request = beginRequest("expand", current.id);
      if (!request) return;
      try {
        const data = parseApiData(
          expansionResultSchema,
          await postJson<unknown>(
            "/api/ai/expand",
            {
              source,
              parentNodeId: parentId,
              sourceAssetId,
              existingWords: current.nodes.map((node) => node.word),
              provider,
              direction: "balanced",
            },
            request.controller.signal,
          ),
        );
        if (!requestIsCurrent(request)) return;
        addExpansion(data.source, parentId, sourceAssetId, data.ideas);
        setStage("canvas");
      } catch (cause) {
        if (!requestIsCurrent(request)) return;
        setError(cause instanceof Error ? cause.message : "气泡生成失败，请重试。");
      } finally {
        finishRequest(request);
      }
    },
    [addExpansion, beginRequest, finishRequest, provider, requestIsCurrent, setError, setStage],
  );

  const summarize = useCallback(
    async (tone: SummaryTone = "default") => {
      const current = useIdeaStore.getState().project;
      if (!current) return;
      const collected = selectCollectedNodes(current);
      const request = beginRequest("summarize", current.id);
      if (!request) return;
      try {
        const data = parseApiData(
          conceptSummarySchema,
          await postJson<unknown>(
            "/api/ai/summarize",
            {
              projectInfo: current.info,
              collectedIdeas: collected.map(({ id, word, category, reason }) => ({
                id,
                word,
                category,
                reason,
              })),
              provider,
              tone,
            },
            request.controller.signal,
          ),
        );
        if (!requestIsCurrent(request)) return;
        setConcept(data);
        setStage("concept");
      } catch (cause) {
        if (!requestIsCurrent(request)) return;
        setError(cause instanceof Error ? cause.message : "总结生成失败，请重试。");
      } finally {
        finishRequest(request);
      }
    },
    [beginRequest, finishRequest, provider, requestIsCurrent, setConcept, setError, setStage],
  );

  const generatePlan = useCallback(async () => {
    const current = useIdeaStore.getState().project;
    if (!current?.currentConcept) return;
    const collected = selectCollectedNodes(current);
    const request = beginRequest("plan", current.id);
    if (!request) return;
    try {
      const data = parseApiData(
        projectPlanSchema,
        await postJson<unknown>(
          "/api/ai/plan",
          {
            projectInfo: current.info,
            concept: current.currentConcept,
            collectedIdeas: collected.map(({ id, word, category, reason, visualHint, relevance }) => ({
              id,
              word,
              category,
              reason,
              visualHint,
              relevance,
            })),
            provider,
          },
          request.controller.signal,
        ),
      );
      if (!requestIsCurrent(request)) return;
      setPlan(data);
      setStage("plan");
    } catch (cause) {
      if (!requestIsCurrent(request)) return;
      setError(cause instanceof Error ? cause.message : "项目计划生成失败，请重试。");
    } finally {
      finishRequest(request);
    }
  }, [beginRequest, finishRequest, provider, requestIsCurrent, setError, setPlan, setStage]);

  const generatePrompt = useCallback(async () => {
    const current = useIdeaStore.getState().project;
    if (!current?.currentPlan) return;
    const request = beginRequest("prompt", current.id);
    if (!request) return;
    try {
      const data = parseApiData(
        imagePromptSchema,
        await postJson<unknown>(
          "/api/ai/prompt",
          {
            projectInfo: current.info,
            plan: current.currentPlan,
            provider,
          },
          request.controller.signal,
        ),
      );
      if (!requestIsCurrent(request)) return;
      saveImagePrompt(data);
    } catch (cause) {
      if (!requestIsCurrent(request)) return;
      setError(cause instanceof Error ? cause.message : "提示词生成失败，请重试。");
    } finally {
      finishRequest(request);
    }
  }, [beginRequest, finishRequest, provider, requestIsCurrent, saveImagePrompt, setError]);

  const createProject = useCallback(
    (info: ProjectInfo) => {
      cancelActiveRequest();
      createNewProject(info);
    },
    [cancelActiveRequest, createNewProject],
  );

  if (!hydrated) return <LoadingShell />;

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#080d16] text-slate-100 lg:min-h-[640px]">
      {project && (
        <TopBar
          projectName={project.info.name}
          hasConcept={Boolean(project.currentConcept)}
          hasPlan={Boolean(project.currentPlan)}
          stage={stage}
          saveStatus={saveStatus}
          provider={provider}
          providerStatus={providerStatus}
          canUndo={past.length > 0}
          canRedo={future.length > 0}
          onStageChange={setStage}
          onNew={() => {
            cancelActiveRequest();
            setWizardOpen(true);
          }}
          onSave={() => void saveNow()}
          onUndo={undo}
          onRedo={redo}
          onExport={() => setExportOpen(true)}
          onHistory={() => {
            cancelActiveRequest();
            setHistoryOpen(true);
          }}
          onProviderChange={setProvider}
        />
      )}

      {project ? (
        <div className="relative grid min-h-0 flex-1 lg:grid-cols-[272px_minmax(0,1fr)_292px]">
          <aside className="hidden min-h-0 border-r border-white/[0.07] lg:block">
            <LeftSidebar key={project.id} project={project} onGenerate={(text) => void expand(text)} />
          </aside>
          <main className="relative min-h-0 min-w-0 pt-12 lg:pt-0">
            <MobileStageNav
              stage={stage}
              hasConcept={Boolean(project.currentConcept)}
              hasPlan={Boolean(project.currentPlan)}
              onChange={setStage}
            />
            {stage === "canvas" && (
              <>
                <InspirationCanvas project={project} onExpand={(word, id) => void expand(word, id)} />
                <CollectionDock project={project} onSummarize={() => void summarize()} />
              </>
            )}
            {stage === "concept" && (
              <ConceptEditor
                project={project}
                onRegenerate={(tone) => void summarize(tone)}
                onGeneratePlan={() => void generatePlan()}
              />
            )}
            {stage === "plan" && (
              <PlanEditor
                project={project}
                onExport={() => setExportOpen(true)}
                onGeneratePrompt={() => void generatePrompt()}
              />
            )}
            <div className="absolute top-3 left-3 z-30 flex gap-2 lg:hidden">
              <Button
                variant="secondary"
                size="icon-sm"
                aria-label="打开灵感入口"
                onClick={() => setLeftOpen(true)}
              >
                <PanelLeft className="size-4" />
              </Button>
            </div>
            <div className="absolute top-3 right-3 z-30 lg:hidden">
              <Button
                variant="secondary"
                size="icon-sm"
                aria-label="打开详情面板"
                onClick={() => setRightOpen(true)}
              >
                <PanelRight className="size-4" />
              </Button>
            </div>
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="absolute top-14 left-1/2 z-40 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-xl border border-red-400/20 bg-[#28131a]/95 px-3 py-2 text-xs text-red-200 shadow-xl backdrop-blur"
              >
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
                <button aria-label="关闭错误提示" onClick={() => setError(undefined)}>
                  <X className="size-3.5" />
                </button>
              </div>
            )}
          </main>
          <aside className="hidden min-h-0 border-l border-white/[0.07] bg-[#0b121e] lg:block">
            {stage === "canvas" ? (
              <NodeDetails project={project} onExpand={(word, id) => void expand(word, id)} />
            ) : (
              <WorkflowPanel project={project} stage={stage} />
            )}
          </aside>
        </div>
      ) : (
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#080d16]">
          <div className="absolute size-[480px] rounded-full bg-[#a8ffcb]/[0.04] blur-3xl" />
          <div className="relative text-center">
            <Layers3 className="mx-auto mb-5 size-10 text-[#a8ffcb]" />
            <h1 className="text-3xl font-semibold">Idea Bubble</h1>
            <p className="mt-2 text-sm text-slate-500">AI 负责发散，你负责选择。</p>
          </div>
        </div>
      )}

      <ProjectWizard
        open={wizardOpen || !project}
        required={!project}
        onOpenChange={setWizardOpen}
        onCreate={createProject}
      />
      <ProjectHistory open={historyOpen} onOpenChange={setHistoryOpen} />
      {project && <ExportDialog open={exportOpen} onOpenChange={setExportOpen} project={project} />}
      {project && (
        <Sheet open={leftOpen} onOpenChange={setLeftOpen}>
          <SheetContent side="left" className="w-[88vw] max-w-sm border-white/10 bg-[#0b121e] p-0 text-white">
            <SheetHeader className="sr-only">
              <SheetTitle>灵感入口</SheetTitle>
              <SheetDescription>输入文字或上传素材</SheetDescription>
            </SheetHeader>
            <LeftSidebar
              key={project.id}
              project={project}
              onGenerate={(text) => {
                setLeftOpen(false);
                void expand(text);
              }}
            />
          </SheetContent>
        </Sheet>
      )}
      {project && (
        <Sheet open={rightOpen} onOpenChange={setRightOpen}>
          <SheetContent
            side="right"
            className="w-[88vw] max-w-sm border-white/10 bg-[#0b121e] p-0 text-white"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>详情</SheetTitle>
              <SheetDescription>查看当前节点或工作流来源</SheetDescription>
            </SheetHeader>
            {stage === "canvas" ? (
              <NodeDetails
                project={project}
                onExpand={(word, id) => {
                  setRightOpen(false);
                  void expand(word, id);
                }}
              />
            ) : (
              <WorkflowPanel project={project} stage={stage} />
            )}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

function MobileStageNav({
  stage,
  hasConcept,
  hasPlan,
  onChange,
}: {
  stage: WorkspaceStage;
  hasConcept: boolean;
  hasPlan: boolean;
  onChange: (stage: WorkspaceStage) => void;
}) {
  return (
    <div className="absolute top-3 left-1/2 z-30 flex -translate-x-1/2 rounded-lg border border-white/10 bg-[#0a111c]/90 p-0.5 backdrop-blur lg:hidden">
      {(["canvas", "concept", "plan"] as const).map((id) => {
        const disabled = (id === "concept" && !hasConcept) || (id === "plan" && !hasPlan);
        return (
          <button
            key={id}
            disabled={disabled}
            onClick={() => onChange(id)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[10px] text-slate-500",
              stage === id && "bg-white/10 text-white",
              disabled && "opacity-25",
            )}
          >
            {id === "canvas" ? "发散" : id === "concept" ? "总结" : "计划"}
          </button>
        );
      })}
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="flex h-dvh min-h-0 flex-col bg-[#080d16] p-4 lg:min-h-[640px]">
      <Skeleton className="h-12 w-full bg-white/[0.04]" />
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[260px_1fr_280px]">
        <Skeleton className="hidden bg-white/[0.03] lg:block" />
        <div className="flex items-center justify-center">
          <LoaderCircle className="size-6 animate-spin text-[#a8ffcb]" />
        </div>
        <Skeleton className="hidden bg-white/[0.03] lg:block" />
      </div>
    </div>
  );
}
