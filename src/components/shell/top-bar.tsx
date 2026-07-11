"use client";

import {
  Archive,
  Bot,
  ChevronRight,
  CloudOff,
  Download,
  FileCheck2,
  History,
  LoaderCircle,
  Plus,
  Redo2,
  Save,
  Settings2,
  Sparkles,
  Undo2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AIProviderId, ProviderStatus, SaveStatus, WorkspaceStage } from "@/lib/domain";
import { cn } from "@/lib/utils";

const providerLabels: Record<AIProviderId, string> = {
  mock: "Mock 演示",
  openai: "OpenAI",
  google: "Google Gemini",
  deepseek: "DeepSeek",
  "openai-compatible": "OpenAI Compatible",
};

const stages: Array<{ id: WorkspaceStage; label: string; number: string }> = [
  { id: "canvas", label: "发散", number: "01" },
  { id: "concept", label: "总结", number: "02" },
  { id: "plan", label: "计划", number: "03" },
];

export function TopBar({
  projectName,
  hasConcept,
  hasPlan,
  stage,
  saveStatus,
  provider,
  providerStatus,
  canUndo,
  canRedo,
  onStageChange,
  onNew,
  onSave,
  onUndo,
  onRedo,
  onExport,
  onHistory,
  onProviderChange,
}: {
  projectName: string;
  hasConcept: boolean;
  hasPlan: boolean;
  stage: WorkspaceStage;
  saveStatus: SaveStatus;
  provider: AIProviderId;
  providerStatus?: ProviderStatus;
  canUndo: boolean;
  canRedo: boolean;
  onStageChange: (stage: WorkspaceStage) => void;
  onNew: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onHistory: () => void;
  onProviderChange: (provider: AIProviderId) => void;
}) {
  return (
    <header className="relative z-50 flex h-[66px] shrink-0 items-center border-b border-white/[0.08] bg-[#080d16]/95 px-3 backdrop-blur-xl md:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#a8ffcb]/30 bg-[#a8ffcb]/10 text-[#a8ffcb] shadow-[0_0_30px_rgba(168,255,203,0.08)]">
          <Sparkles className="size-4" />
        </div>
        <div className="hidden min-w-0 sm:block">
          <p className="font-mono text-[9px] tracking-[0.2em] text-slate-500 uppercase">Idea Bubble</p>
          <p className="max-w-48 truncate text-sm font-medium text-slate-100 xl:max-w-64">{projectName}</p>
        </div>
      </div>

      <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.035] p-1 lg:flex">
        {stages.map((item, index) => {
          const disabled = (item.id === "concept" && !hasConcept) || (item.id === "plan" && !hasPlan);
          return (
            <div key={item.id} className="flex items-center">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onStageChange(item.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors",
                  stage === item.id ? "bg-white/[0.08] text-white" : "text-slate-500 hover:text-slate-300",
                  disabled && "cursor-not-allowed opacity-35",
                )}
              >
                <span className="font-mono text-[9px] text-[#a8ffcb]">{item.number}</span>
                {item.label}
              </button>
              {index < stages.length - 1 && <ChevronRight className="size-3 text-slate-700" />}
            </div>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-1">
        <SaveIndicator status={saveStatus} />
        <Separator orientation="vertical" className="mx-1 h-5 bg-white/10" />
        <IconButton label="新建项目" onClick={onNew}>
          <Plus />
        </IconButton>
        <IconButton label="手动保存" onClick={onSave}>
          <Save />
        </IconButton>
        <IconButton label="撤销" onClick={onUndo} disabled={!canUndo}>
          <Undo2 />
        </IconButton>
        <IconButton label="重做" onClick={onRedo} disabled={!canRedo}>
          <Redo2 />
        </IconButton>
        <IconButton label="项目历史" onClick={onHistory}>
          <History />
        </IconButton>

        <Dialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="ml-1 h-9 gap-2 text-xs text-slate-300">
                  <Bot className="size-4 text-[#a8ffcb]" />
                  <span className="hidden xl:inline">{providerLabels[provider]}</span>
                  {providerStatus?.demoMode && <span className="size-1.5 rounded-full bg-[#ff9d73]" />}
                </Button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent>模型设置</TooltipContent>
          </Tooltip>
          <ProviderDialog provider={provider} status={providerStatus} onChange={onProviderChange} />
        </Dialog>

        <Button
          size="sm"
          disabled={!hasPlan}
          onClick={onExport}
          className="ml-1 h-9 bg-[#a8ffcb] px-3 text-[#07120d] hover:bg-[#90efb6] disabled:bg-slate-700"
        >
          <Download className="size-4" />
          <span className="hidden md:inline">导出项目</span>
        </Button>
      </div>
    </header>
  );
}

function IconButton({ label, children, ...props }: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const view = {
    idle: { icon: CloudOff, label: "尚未保存", className: "text-slate-500" },
    dirty: { icon: Archive, label: "有更改", className: "text-amber-300" },
    saving: { icon: LoaderCircle, label: "保存中", className: "text-sky-300" },
    saved: { icon: FileCheck2, label: "已保存", className: "text-emerald-300" },
    error: { icon: CloudOff, label: "保存失败", className: "text-red-300" },
  }[status];
  const Icon = view.icon;
  return (
    <div
      aria-live="polite"
      aria-label={view.label}
      title={view.label}
      className={cn("flex items-center gap-1.5 px-1 font-mono text-[10px]", view.className)}
    >
      <Icon className={cn("size-3.5", status === "saving" && "animate-spin")} />
      <span className="hidden md:inline">{view.label}</span>
    </div>
  );
}

function ProviderDialog({
  provider,
  status,
  onChange,
}: {
  provider: AIProviderId;
  status?: ProviderStatus;
  onChange: (provider: AIProviderId) => void;
}) {
  const ids = Object.keys(providerLabels) as AIProviderId[];
  return (
    <DialogContent className="border-white/10 bg-[#0d1422] text-white sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Settings2 className="size-5 text-[#a8ffcb]" />
          模型设置
        </DialogTitle>
        <DialogDescription>密钥和接口地址只从服务端环境变量读取，不会进入浏览器。</DialogDescription>
      </DialogHeader>
      {status?.demoMode && (
        <div className="rounded-xl border border-[#ff9d73]/25 bg-[#ff9d73]/[0.08] p-3 text-xs leading-5 text-[#ffc3a7]">
          当前为演示模式。未配置有效密钥时，选择任意供应商也会安全回退到 Mock。
        </div>
      )}
      <div className="grid gap-2">
        {ids.map((id) => {
          const available = status?.availableProviders[id] ?? id === "mock";
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                "flex items-center justify-between rounded-xl border p-3 text-left transition-colors",
                provider === id
                  ? "border-[#a8ffcb]/45 bg-[#a8ffcb]/[0.07]"
                  : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]",
              )}
            >
              <div>
                <p className="text-sm font-medium">{providerLabels[id]}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {id === "mock"
                    ? "稳定演示数据，不消耗 API"
                    : available
                      ? "服务端已检测到配置"
                      : "尚未配置，将回退到 Mock"}
                </p>
              </div>
              <Badge
                variant="outline"
                className={
                  available ? "border-emerald-400/20 text-emerald-300" : "border-white/10 text-slate-500"
                }
              >
                {available ? "可用" : "未配置"}
              </Badge>
            </button>
          );
        })}
      </div>
      {status && (
        <div className="rounded-xl bg-black/20 p-3">
          <p className="mb-2 font-mono text-[9px] tracking-wider text-slate-500 uppercase">Task routing</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] text-slate-400">
            {Object.entries(status.taskModels).map(([task, model]) => (
              <div key={task} className="flex justify-between gap-2">
                <span>{task}</span>
                <span className="truncate text-slate-600">{model}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </DialogContent>
  );
}
