"use client";

import { useMemo, useState } from "react";
import { ArrowDownAZ, Lightbulb, Settings2, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/domain";
import { canSummarize, selectCollectedNodes, useIdeaStore } from "@/store/idea-store";

export function CollectionDock({ project, onSummarize }: { project: Project; onSummarize: () => void }) {
  const [sorted, setSorted] = useState(false);
  const threshold = useIdeaStore((state) => state.collectionThreshold);
  const setThreshold = useIdeaStore((state) => state.setCollectionThreshold);
  const toggleCollect = useIdeaStore((state) => state.toggleCollect);
  const clearCollection = useIdeaStore((state) => state.clearCollection);
  const busyTask = useIdeaStore((state) => state.busyTask);
  const aiProgress = useIdeaStore((state) => state.aiProgress);
  const collected = selectCollectedNodes(project);
  const visible = useMemo(
    () => (sorted ? [...collected].sort((a, b) => a.category.localeCompare(b.category, "zh-CN")) : collected),
    [collected, sorted],
  );
  const remaining = Math.max(0, threshold - collected.length);
  const ready = canSummarize(project, threshold);

  return (
    <div
      id="collection-dock"
      className="collection-dock absolute inset-x-3 bottom-3 z-20 rounded-2xl border border-white/10 bg-[#0b121e]/94 shadow-[0_18px_60px_rgba(0,0,0,.38)] backdrop-blur-xl"
    >
      <div className="flex min-h-[92px] items-center gap-3 p-3">
        <div className="hidden w-36 shrink-0 border-r border-white/10 pr-4 sm:block">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
            <Lightbulb className="size-4 text-[#a8ffcb]" />
            灵感收集栏
          </div>
          <p className="mt-1 font-mono text-[9px] text-slate-500">
            {collected.length}/{threshold} SELECTED
          </p>
          <Progress value={Math.min(100, (collected.length / threshold) * 100)} className="mt-2 h-1" />
        </div>

        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-1">
          {visible.length === 0 && (
            <div className="flex min-h-11 items-center text-xs text-slate-600">
              单击喜欢的气泡，把人的判断放进创意过程。
            </div>
          )}
          {visible.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => toggleCollect(node.id)}
              className="group flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] py-2 pr-2 pl-3 text-xs text-slate-300 transition-colors hover:border-red-300/30 hover:text-red-200"
            >
              <span className="size-1.5 rounded-full bg-[#a8ffcb]" />
              {node.word}
              <X className="size-3 opacity-35 group-hover:opacity-100" />
            </button>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-1 border-l border-white/10 pl-3">
          <span className="font-mono text-[9px] text-slate-500 sm:hidden">
            {collected.length}/{threshold}
          </span>
          <Button
            size="icon-sm"
            variant="ghost"
            title="按分类排序"
            onClick={() => setSorted((value) => !value)}
            className={cn(sorted && "text-[#a8ffcb]")}
          >
            <ArrowDownAZ className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            title="清空收集"
            disabled={!collected.length}
            onClick={clearCollection}
          >
            <Trash2 className="size-4" />
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="icon-sm" variant="ghost" title="调整总结阈值">
                <Settings2 className="size-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="border-white/10 bg-[#0d1422] text-white sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>总结阈值</DialogTitle>
                <DialogDescription>达到数量后只会启用按钮，不会自动调用 AI。</DialogDescription>
              </DialogHeader>
              <div className="py-5">
                <div className="mb-4 flex items-center justify-between text-sm">
                  <span>目标数量</span>
                  <span className="font-mono text-[#a8ffcb]">{threshold}</span>
                </div>
                <Slider
                  value={[threshold]}
                  min={3}
                  max={10}
                  step={1}
                  onValueChange={([value]) => setThreshold(value)}
                />
              </div>
            </DialogContent>
          </Dialog>
          <Button
            size="sm"
            aria-label={ready ? "总结灵感" : `还差 ${remaining} 个灵感`}
            disabled={!ready || Boolean(busyTask)}
            onClick={onSummarize}
            className="ml-1 h-10 bg-[#a8ffcb] px-3 text-[#07120d] hover:bg-[#91efb7] disabled:bg-slate-800 disabled:text-slate-500"
          >
            <Sparkles className={cn("size-4", busyTask === "summarize" && "animate-spin")} />
            <span className="hidden md:inline">{ready ? "总结灵感" : `还差 ${remaining} 个`}</span>
          </Button>
        </div>
      </div>
      {busyTask === "summarize" && (
        <div className="border-t border-white/10 px-4 pt-2 pb-3">
          <div className="mb-1 flex justify-between text-[10px] text-slate-400">
            <span>正在生成概念总结</span>
            <span>{aiProgress}%</span>
          </div>
          <Progress value={aiProgress} className="h-1.5" />
        </div>
      )}
    </div>
  );
}
