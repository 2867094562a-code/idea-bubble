"use client";

import { CheckCircle2, GitBranch, Lightbulb, Route, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Project, WorkspaceStage } from "@/lib/domain";
import { selectCollectedNodes, useIdeaStore } from "@/store/idea-store";

export function WorkflowPanel({ project, stage }: { project: Project; stage: WorkspaceStage }) {
  const threshold = useIdeaStore((state) => state.collectionThreshold);
  const collected = selectCollectedNodes(project);
  const sourceIds =
    stage === "plan" ? project.currentPlan?.sourceNodeIds : project.currentConcept?.sourceNodeIds;
  const sources = project.nodes.filter((node) => sourceIds?.includes(node.id));
  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 p-4">
        <div>
          <p className="font-mono text-[9px] tracking-[0.16em] text-slate-600 uppercase">Source trail</p>
          <h3 className="mt-1 text-sm font-medium text-slate-200">来源与进度</h3>
        </div>
        <div className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
          <Progress value={stage === "plan" ? 100 : stage === "concept" ? 68 : 28} className="h-1" />
          <div className="space-y-2 text-xs">
            <Step done label="原始输入" value={`${project.originalInputs.length + project.assets.length}`} />
            <Step
              done={collected.length >= threshold}
              label="人工收集"
              value={`${collected.length}/${threshold}`}
            />
            <Step
              done={Boolean(project.currentConcept)}
              label="创意总结"
              value={`${project.conceptVersions.length} 版本`}
            />
            <Step
              done={Boolean(project.currentPlan)}
              label="项目计划"
              value={`${project.planVersions.length} 版本`}
            />
          </div>
        </div>

        <section>
          <div className="mb-2 flex items-center gap-2">
            <Lightbulb className="size-3.5 text-[#a8ffcb]" />
            <p className="text-xs font-medium text-slate-300">已收集灵感</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {collected.map((node) => (
              <Badge
                key={node.id}
                variant="outline"
                className="border-white/10 bg-white/[0.03] text-[10px] text-slate-400"
              >
                {node.word}
              </Badge>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2">
            <GitBranch className="size-3.5 text-[#ffb28b]" />
            <p className="text-xs font-medium text-slate-300">当前内容来源</p>
          </div>
          <div className="space-y-2">
            {sources.map((node) => (
              <div key={node.id} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">{node.word}</span>
                  <span className="font-mono text-[8px] text-slate-600">{node.category}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-600">{node.reason}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="rounded-xl border border-[#a8ffcb]/15 bg-[#a8ffcb]/[0.035] p-3 text-[11px] leading-5 text-slate-400">
          <div className="mb-2 flex items-center gap-2 text-[#a8ffcb]">
            <Route className="size-3.5" />
            <span className="font-medium">可追溯性已保留</span>
          </div>
          总结、计划与提示词都保存来源节点 ID；导出报告不会暴露这些内部 ID。
        </div>
      </div>
    </ScrollArea>
  );
}

function Step({ done, label, value }: { done: boolean; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-slate-400">
        {done ? (
          <CheckCircle2 className="size-3.5 text-[#a8ffcb]" />
        ) : (
          <Sparkles className="size-3.5 text-slate-700" />
        )}
        {label}
      </span>
      <span className="font-mono text-[9px] text-slate-600">{value}</span>
    </div>
  );
}
