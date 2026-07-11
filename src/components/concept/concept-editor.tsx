"use client";

import { ArrowRight, BookmarkPlus, Copy, History, LoaderCircle, RefreshCcw, Sparkles } from "lucide-react";
import { MessageResponse } from "@/components/ai-elements/message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Project } from "@/lib/domain";
import { useIdeaStore } from "@/store/idea-store";

const tones = [
  ["concise", "更简洁"],
  ["professional", "更专业"],
  ["bold", "更大胆"],
  ["commercial", "更商业"],
  ["visual", "更具视觉感"],
] as const;

export function ConceptEditor({
  project,
  onRegenerate,
  onGeneratePlan,
}: {
  project: Project;
  onRegenerate: (tone: (typeof tones)[number][0]) => void;
  onGeneratePlan: () => void;
}) {
  const concept = project.currentConcept;
  const updateConcept = useIdeaStore((state) => state.updateConcept);
  const setConcept = useIdeaStore((state) => state.setConcept);
  const saveConceptVersion = useIdeaStore((state) => state.saveConceptVersion);
  const busyTask = useIdeaStore((state) => state.busyTask);

  if (!concept) return null;
  const markdown = `# ${concept.title}\n\n${concept.summary}\n\n**关键词：** ${concept.keywords.join(" · ")}`;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#09111d]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="bg-[#a8ffcb]/10 text-[#a8ffcb]">创意总结</Badge>
            <span className="font-mono text-[9px] text-slate-600">
              {concept.sourceNodeIds.length} SOURCES
            </span>
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">把选择收束成一个方向</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => saveConceptVersion()}>
            <BookmarkPlus className="size-4" />
            保存版本
          </Button>
          <Button
            size="sm"
            disabled={Boolean(busyTask)}
            onClick={onGeneratePlan}
            className="bg-[#a8ffcb] text-[#07120d] hover:bg-[#91efb7]"
          >
            {busyTask === "plan" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <ArrowRight className="size-4" />
            )}
            生成项目计划
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto grid max-w-6xl gap-5 p-5 xl:grid-cols-[1fr_320px]">
          <Card className="border-white/[0.08] bg-white/[0.025]">
            <CardHeader>
              <CardTitle className="text-base">创意说明</CardTitle>
              <CardDescription>直接编辑不会覆盖已保存的历史版本。</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="edit">
                <TabsList className="mb-4 bg-black/20">
                  <TabsTrigger value="edit">编辑</TabsTrigger>
                  <TabsTrigger value="preview">阅读预览</TabsTrigger>
                </TabsList>
                <TabsContent value="edit" className="space-y-4">
                  <Input
                    value={concept.title}
                    onChange={(event) => updateConcept({ title: event.target.value })}
                    className="h-12 text-lg font-semibold"
                  />
                  <Textarea
                    value={concept.summary}
                    onChange={(event) => updateConcept({ summary: event.target.value })}
                    rows={14}
                    className="resize-none leading-7"
                  />
                  <div>
                    <p className="mb-2 text-xs text-slate-500">关键词（用逗号分隔）</p>
                    <Input
                      value={concept.keywords.join("，")}
                      onChange={(event) =>
                        updateConcept({
                          keywords: event.target.value
                            .split(/[，,]/)
                            .map((item) => item.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </div>
                </TabsContent>
                <TabsContent value="preview">
                  <article className="min-h-[420px] rounded-xl border border-white/[0.07] bg-[#0d1522] p-6 text-sm leading-7">
                    <MessageResponse>{markdown}</MessageResponse>
                  </article>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="border-white/[0.08] bg-white/[0.025]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Sparkles className="size-4 text-[#a8ffcb]" />
                  调整表达
                </CardTitle>
                <CardDescription>会生成新草稿，不改动已保存版本。</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {tones.map(([id, label]) => (
                  <Button
                    key={id}
                    variant="outline"
                    size="sm"
                    disabled={Boolean(busyTask)}
                    onClick={() => onRegenerate(id)}
                  >
                    {label}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="col-span-2"
                  disabled={Boolean(busyTask)}
                  onClick={() => onRegenerate("professional")}
                >
                  <RefreshCcw className="size-3.5" />
                  重新生成
                </Button>
              </CardContent>
            </Card>

            <Card className="border-white/[0.08] bg-white/[0.025]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <History className="size-4 text-[#ffb28b]" />
                  历史版本
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {project.conceptVersions.length === 0 && (
                  <p className="text-xs leading-5 text-slate-600">
                    保存版本后，可以随时恢复而不丢失当前草稿。
                  </p>
                )}
                {project.conceptVersions.map((version) => (
                  <div
                    key={version.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.07] p-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs text-slate-300">{version.name}</p>
                      <p className="mt-1 font-mono text-[8px] text-slate-600">
                        {new Date(version.createdAt).toLocaleString("zh-CN")}
                      </p>
                    </div>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="恢复为当前草稿"
                      onClick={() => setConcept(structuredClone(version.data))}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
