"use client";

import { useState } from "react";
import { FileText, Image as ImageIcon, LoaderCircle, Pencil, Plus, Sparkles } from "lucide-react";
import { AssetUploader } from "@/components/media/asset-uploader";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Project, ProjectInfo } from "@/lib/domain";
import { MAX_PROJECT_NODES } from "@/lib/defaults";
import { useIdeaStore } from "@/store/idea-store";

export function LeftSidebar({
  project,
  onGenerate,
}: {
  project: Project;
  onGenerate: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const busyTask = useIdeaStore((state) => state.busyTask);
  const aiProgress = useIdeaStore((state) => state.aiProgress);
  const remainingNodes = MAX_PROJECT_NODES - project.nodes.length;
  const submit = () => {
    const value = text.trim();
    if (!value || busyTask) return;
    onGenerate(value);
    setText("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0b121e]">
      <div className="flex h-12 items-center justify-between border-b border-white/[0.07] pr-12 pl-4 lg:pr-4">
        <div>
          <p className="text-xs font-medium text-slate-200">灵感入口</p>
          <p className="font-mono text-[8px] tracking-wider text-slate-600 uppercase">Source material</p>
        </div>
        <Badge variant="outline" className="border-white/10 font-mono text-[8px] text-slate-500">
          {project.originalInputs.length + project.assets.length} ITEMS
        </Badge>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-3">
          <Tabs defaultValue="text">
            <TabsList className="grid w-full grid-cols-2 bg-black/20">
              <TabsTrigger value="text" className="gap-1.5 text-xs">
                <FileText className="size-3.5" />
                文字
              </TabsTrigger>
              <TabsTrigger value="media" className="gap-1.5 text-xs">
                <ImageIcon className="size-3.5" />
                媒体
              </TabsTrigger>
            </TabsList>
            <TabsContent value="text" className="mt-3 space-y-3">
              <div className="relative">
                <Textarea
                  value={text}
                  onChange={(event) => setText(event.target.value.slice(0, 500))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit();
                  }}
                  placeholder="输入一个词、一句话，或一段简短说明……"
                  className="min-h-32 resize-none border-white/10 bg-white/[0.035] pr-3 pb-7 leading-6"
                />
                <span className="absolute right-2 bottom-2 font-mono text-[9px] text-slate-600">
                  {text.length}/500
                </span>
              </div>
              <Button
                className="w-full bg-[#a8ffcb] text-[#07120d] hover:bg-[#91efb7]"
                disabled={!text.trim() || Boolean(busyTask)}
                onClick={submit}
              >
                {busyTask === "expand" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                生成 10 个灵感气泡
              </Button>
              {busyTask === "expand" && (
                <div className="space-y-1.5 px-1">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>正在生成灵感</span>
                    <span>{aiProgress}%</span>
                  </div>
                  <Progress value={aiProgress} className="h-1.5" />
                </div>
              )}
              <p
                className={
                  remainingNodes <= 20
                    ? "text-center text-[10px] text-amber-300"
                    : "text-center text-[10px] text-slate-600"
                }
              >
                节点容量：{project.nodes.length}/{MAX_PROJECT_NODES}（剩余 {remainingNodes}）
                {remainingNodes <= 20 ? "，请整理或删除分支后继续。" : ""}
              </p>
              <p className="text-center font-mono text-[8px] text-slate-600">⌘ / CTRL + ENTER</p>
            </TabsContent>
            <TabsContent value="media" className="mt-3">
              <AssetUploader />
            </TabsContent>
          </Tabs>

          <ProjectInfoCard project={project} />

          <section>
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="font-mono text-[9px] tracking-wider text-slate-500 uppercase">
                Recent inspirations
              </p>
              <span className="text-[10px] text-slate-700">最近灵感</span>
            </div>
            <div className="space-y-1.5">
              {project.originalInputs.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-[11px] text-slate-600">
                  生成后会出现在这里
                </div>
              )}
              {project.originalInputs
                .slice(-5)
                .reverse()
                .map((input, index) => (
                  <button
                    key={`${input}-${index}`}
                    type="button"
                    onClick={() => setText(input)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-200"
                  >
                    <span className="size-1.5 rounded-full bg-[#a8ffcb]/70" />
                    <span className="truncate">{input}</span>
                  </button>
                ))}
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

function ProjectInfoCard({ project }: { project: Project }) {
  const updateProjectInfo = useIdeaStore((state) => state.updateProjectInfo);
  const [draft, setDraft] = useState<ProjectInfo>(project.info);
  const update = <K extends keyof ProjectInfo>(field: K, value: ProjectInfo[K]) =>
    setDraft((current) => ({ ...current, [field]: value }));
  return (
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-200">{project.info.name}</p>
          <p className="mt-1 text-[10px] text-slate-500">{project.info.type}</p>
        </div>
        <Dialog onOpenChange={(open) => open && setDraft(project.info)}>
          <DialogTrigger asChild>
            <Button size="icon-sm" variant="ghost" className="size-7">
              <Pencil className="size-3.5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#0d1422] text-white sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>项目资料</DialogTitle>
              <DialogDescription>这些约束会随每次 AI 请求一起传入。</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoField label="项目名称">
                <Input value={draft.name} onChange={(event) => update("name", event.target.value)} />
              </InfoField>
              <InfoField label="项目类型">
                <Input value={draft.type} disabled />
              </InfoField>
              <InfoField label="要设计的物品" wide>
                <Input
                  value={draft.designObject}
                  onChange={(event) => update("designObject", event.target.value.slice(0, 120))}
                  placeholder="例如：城市通勤鞋、桌面台灯、保温杯"
                />
                <p className="text-[11px] text-slate-500">
                  此项会决定最终生图提示词的主体，可在灵感发散中途修改。
                </p>
              </InfoField>
              <InfoField label="项目目标" wide>
                <Textarea value={draft.goal} onChange={(event) => update("goal", event.target.value)} />
              </InfoField>
              <InfoField label="目标人群">
                <Input value={draft.audience} onChange={(event) => update("audience", event.target.value)} />
              </InfoField>
              <InfoField label="使用场景">
                <Input value={draft.scenario} onChange={(event) => update("scenario", event.target.value)} />
              </InfoField>
              <InfoField label="补充要求">
                <Textarea
                  value={draft.requirements}
                  onChange={(event) => update("requirements", event.target.value)}
                />
              </InfoField>
              <InfoField label="禁止元素">
                <Textarea
                  value={draft.forbiddenElements}
                  onChange={(event) => update("forbiddenElements", event.target.value)}
                />
              </InfoField>
            </div>
            <Button className="ml-auto bg-[#a8ffcb] text-[#07120d]" onClick={() => updateProjectInfo(draft)}>
              <Plus className="size-4" />
              保存资料
            </Button>
          </DialogContent>
        </Dialog>
      </div>
      <p className="mt-3 line-clamp-2 text-[11px] leading-5 text-slate-500">
        {project.info.goal || "还没有填写项目目标，可随时补充。"}
      </p>
    </section>
  );
}

function InfoField({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "space-y-2 sm:col-span-2" : "space-y-2"}>
      <Label className="text-xs text-slate-400">{label}</Label>
      {children}
    </div>
  );
}
