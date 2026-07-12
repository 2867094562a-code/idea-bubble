"use client";

import { useState, type ReactElement } from "react";
import { Eye, EyeOff, KeyRound, Settings2, ShieldAlert, Trash2 } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AI_TASK_LABELS,
  configuredTaskCount,
  createDefaultAIConfig,
  normalizeAIConfig,
} from "@/lib/client-ai-config";
import type { AIProviderConfig, AIProviderId, AITask } from "@/lib/domain";

export const AI_PROVIDER_LABELS: Record<AIProviderId, string> = {
  mock: "Mock 演示",
  openai: "OpenAI",
  google: "Google Gemini",
  deepseek: "DeepSeek",
  mimo: "Xiaomi MiMo",
  "openai-compatible": "OpenAI Compatible",
};

const PROVIDER_IDS = Object.keys(AI_PROVIDER_LABELS) as AIProviderId[];
const TASK_IDS = Object.keys(AI_TASK_LABELS) as AITask[];

function isValidHttpsBaseURL(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

interface ProviderDialogProps {
  config: AIProviderConfig;
  trigger: ReactElement;
  onSave: (config: AIProviderConfig) => void;
  onClear: () => void;
}

export function ProviderDialog({ config, trigger, onSave, onClear }: ProviderDialogProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AIProviderConfig>(() => normalizeAIConfig(config));
  const [showKey, setShowKey] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    setShowKey(false);
    setDraft(nextOpen ? normalizeAIConfig(config) : createDefaultAIConfig());
  };

  const changeProvider = (provider: AIProviderId) => {
    if (provider === draft.provider) return;
    setDraft({ ...createDefaultAIConfig(), provider });
    setShowKey(false);
  };

  const updateModel = (task: AITask, value: string) => {
    setDraft((current) => ({
      ...current,
      models: { ...current.models, [task]: value },
    }));
  };

  const save = () => {
    onSave(draft);
    handleOpenChange(false);
  };

  const clear = () => {
    onClear();
    handleOpenChange(false);
  };

  const configured = configuredTaskCount(normalizeAIConfig(draft));
  const compatibleNeedsURL = draft.provider === "openai-compatible";
  const mimoSupportsCustomURL = draft.provider === "mimo";
  const canSave =
    draft.provider === "mock" ||
    (Boolean(draft.apiKey.trim()) && (!compatibleNeedsURL || isValidHttpsBaseURL(draft.baseURL.trim())));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>{trigger}</DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>模型设置</TooltipContent>
      </Tooltip>

      <DialogContent className="max-h-[92dvh] overflow-y-auto border-white/10 bg-[#0d1422] text-white sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="size-5 text-[#a8ffcb]" />
            模型设置
          </DialogTitle>
          <DialogDescription className="leading-5">
            每位用户自行填写配置；内容只保存在当前浏览器，不进入项目、导出文件或云端数据库。
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-[#a8ffcb]/15 bg-[#a8ffcb]/[0.05] p-3 text-xs leading-5 text-slate-300">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[#ffb28b]" aria-hidden="true" />
            <p>
              真实请求会由浏览器直接发给所选 Provider，密钥不会经过 Idea Bubble 服务器，但会发送给该
              Provider，也可被本机浏览器环境读取。公共设备请勿保存；Provider 的 CORS 策略可能阻止浏览器直连。
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-provider">Provider</Label>
          <Select value={draft.provider} onValueChange={(value) => changeProvider(value as AIProviderId)}>
            <SelectTrigger id="ai-provider" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_IDS.map((provider) => (
                <SelectItem key={provider} value={provider}>
                  {AI_PROVIDER_LABELS[provider]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] leading-4 text-slate-500">
            切换 Provider 会清空当前草稿中的密钥、接口地址和模型，避免把凭据误发给其他服务。
          </p>
        </div>

        {draft.provider === "mock" ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-300">
            Mock 不需要 API Key，也不会调用外部模型，可完整体验项目流程。
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="ai-api-key">API Key</Label>
                <Badge variant="outline" className="border-white/10 text-slate-400">
                  仅本浏览器
                </Badge>
              </div>
              <div className="relative">
                <KeyRound
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"
                  aria-hidden="true"
                />
                <Input
                  id="ai-api-key"
                  type={showKey ? "text" : "password"}
                  value={draft.apiKey}
                  onChange={(event) => setDraft((current) => ({ ...current, apiKey: event.target.value }))}
                  className="pr-11 pl-9"
                  placeholder="粘贴你自己的 API Key"
                  autoComplete="new-password"
                  spellCheck={false}
                  maxLength={2048}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1/2 right-1 -translate-y-1/2 text-slate-400"
                  onClick={() => setShowKey((current) => !current)}
                  aria-label={showKey ? "隐藏 API Key" : "显示 API Key"}
                  aria-pressed={showKey}
                >
                  {showKey ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </Button>
              </div>
            </div>

            {compatibleNeedsURL ? (
              <div className="space-y-2">
                <Label htmlFor="ai-base-url">HTTPS Base URL</Label>
                <Input
                  id="ai-base-url"
                  type="url"
                  inputMode="url"
                  value={draft.baseURL}
                  onChange={(event) => setDraft((current) => ({ ...current, baseURL: event.target.value }))}
                  placeholder="https://provider.example/v1"
                  spellCheck={false}
                  maxLength={500}
                />
                <p className="text-[11px] leading-4 text-slate-500">
                  密钥会直接发送到这个地址。请只填写你信任且允许浏览器跨域访问的 HTTPS 服务。
                </p>
              </div>
            ) : null}

            {mimoSupportsCustomURL ? (
              <div className="space-y-2">
                <Label htmlFor="mimo-base-url">MiMo Base URL（可选）</Label>
                <Input
                  id="mimo-base-url"
                  type="url"
                  inputMode="url"
                  value={draft.baseURL}
                  onChange={(event) => setDraft((current) => ({ ...current, baseURL: event.target.value }))}
                  placeholder="https://token-plan-cn.xiaomimimo.com/v1"
                  spellCheck={false}
                  maxLength={500}
                />
                <p className="text-[11px] leading-4 text-slate-500">
                  留空时使用按量 API 的官方地址 <code>https://api.xiaomimimo.com/v1</code>。Token Plan
                  请填写小米控制台提供的专属 HTTPS 地址；两种方式都会使用 <code>api-key</code> 认证。
                </p>
              </div>
            ) : null}

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">任务模型</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    模型名称完全由你提供，未填写的任务不会发起请求。
                  </p>
                </div>
                <Badge variant="outline" className="border-[#a8ffcb]/20 text-[#a8ffcb]">
                  {configured}/5
                </Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {TASK_IDS.map((task) => (
                  <div key={task} className="space-y-1.5">
                    <Label htmlFor={`ai-model-${task}`} className="text-xs text-slate-300">
                      {AI_TASK_LABELS[task]}
                    </Label>
                    <Input
                      id={`ai-model-${task}`}
                      value={draft.models[task]}
                      onChange={(event) => updateModel(task, event.target.value)}
                      placeholder="输入模型名称"
                      spellCheck={false}
                      maxLength={160}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" className="text-red-300" onClick={clear}>
            <Trash2 aria-hidden="true" />
            清除本地配置
          </Button>
          <Button
            type="button"
            disabled={!canSave}
            onClick={save}
            className="bg-[#a8ffcb] text-[#07120d] hover:bg-[#90efb6]"
          >
            保存到当前浏览器
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
