"use client";

import { BookmarkPlus, CheckCircle2, Copy, Download, ImagePlus, LoaderCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { Project, ProjectPlan } from "@/lib/domain";
import { useIdeaStore } from "@/store/idea-store";

const textSections: Array<{
  key: keyof Pick<ProjectPlan, "executiveSummary" | "background" | "problemDefinition">;
  title: string;
  description: string;
}> = [
  { key: "executiveSummary", title: "项目概述", description: "面向决策者的核心说明" },
  { key: "background", title: "项目背景", description: "为什么现在值得做" },
  { key: "problemDefinition", title: "问题定义", description: "本项目真正要解决的问题" },
];

const listSections: Array<{
  key: keyof Pick<
    ProjectPlan,
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
  title: string;
}> = [
  { key: "targetAudience", title: "目标人群" },
  { key: "usageScenarios", title: "使用场景" },
  { key: "projectGoals", title: "项目目标" },
  { key: "coreIdeas", title: "核心创意" },
  { key: "designDirection", title: "设计方向" },
  { key: "visualDirection", title: "视觉方向" },
  { key: "functionalDirection", title: "功能方向" },
  { key: "materialsOrResources", title: "材料与资源" },
  { key: "colorDirection", title: "色彩方向" },
  { key: "risks", title: "风险" },
  { key: "validationMethods", title: "验证方式" },
  { key: "nextActions", title: "下一步行动" },
];

export function PlanEditor({
  project,
  onExport,
  onGeneratePrompt,
}: {
  project: Project;
  onExport: () => void;
  onGeneratePrompt: () => void;
}) {
  const plan = project.currentPlan;
  const updatePlanText = useIdeaStore((state) => state.updatePlanText);
  const updatePlanList = useIdeaStore((state) => state.updatePlanList);
  const updateExecutionStep = useIdeaStore((state) => state.updateExecutionStep);
  const savePlanVersion = useIdeaStore((state) => state.savePlanVersion);
  const restorePlanVersion = useIdeaStore((state) => state.restorePlanVersion);
  const markFinalPlanVersion = useIdeaStore((state) => state.markFinalPlanVersion);
  const busyTask = useIdeaStore((state) => state.busyTask);
  const prompt = project.imagePromptVersions[0];
  if (!plan) return null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#09111d]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="bg-[#a8ffcb]/10 text-[#a8ffcb]">项目计划</Badge>
            <span className="font-mono text-[9px] text-slate-600">EDITABLE · TRACEABLE</span>
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">{plan.projectName}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => savePlanVersion()}>
            <BookmarkPlus className="size-4" />
            保存版本
          </Button>
          <Button variant="outline" size="sm" disabled={Boolean(busyTask)} onClick={onGeneratePrompt}>
            {busyTask === "prompt" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <ImagePlus className="size-4" />
            )}
            生图提示词（可选）
          </Button>
          <Button size="sm" onClick={onExport} className="bg-[#a8ffcb] text-[#07120d] hover:bg-[#91efb7]">
            <Download className="size-4" />
            直接导出
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-6xl space-y-5 p-5">
          <Card className="border-[#a8ffcb]/15 bg-[#a8ffcb]/[0.035]">
            <CardContent className="grid gap-4 pt-5 md:grid-cols-[1fr_1fr_2fr]">
              <Field label="项目名称">
                <Input
                  value={plan.projectName}
                  onChange={(event) => updatePlanText("projectName", event.target.value)}
                />
              </Field>
              <Field label="副标题">
                <Input
                  value={plan.subtitle}
                  onChange={(event) => updatePlanText("subtitle", event.target.value)}
                />
              </Field>
              <Field label="一句话概念">
                <Input
                  value={plan.oneLineConcept}
                  onChange={(event) => updatePlanText("oneLineConcept", event.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-3">
            {textSections.map((section) => (
              <Card key={section.key} className="border-white/[0.08] bg-white/[0.025]">
                <CardHeader>
                  <CardTitle className="text-sm">{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={plan[section.key]}
                    onChange={(event) => updatePlanText(section.key, event.target.value)}
                    rows={8}
                    className="resize-none leading-6"
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {listSections.map((section) => (
              <Card key={section.key} className="border-white/[0.08] bg-white/[0.025]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{section.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={plan[section.key].join("\n")}
                    onChange={(event) => updatePlanList(section.key, lines(event.target.value))}
                    rows={6}
                    className="resize-none text-sm leading-6"
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-white/[0.08] bg-white/[0.025]">
            <CardHeader>
              <CardTitle className="text-base">执行步骤</CardTitle>
              <CardDescription>每个阶段都可独立编辑，避免一堵不可维护的长文本。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {plan.executionSteps.map((step, index) => (
                <div
                  key={`${step.stage}-${index}`}
                  className="grid gap-3 rounded-xl border border-white/[0.08] bg-black/10 p-4 lg:grid-cols-[180px_1fr_1fr_1fr]"
                >
                  <div className="space-y-2">
                    <span className="font-mono text-[9px] text-[#a8ffcb]">
                      STAGE {String(index + 1).padStart(2, "0")}
                    </span>
                    <Input
                      value={step.stage}
                      onChange={(event) => updateExecutionStep(index, { stage: event.target.value })}
                    />
                    <Textarea
                      value={step.objective}
                      onChange={(event) => updateExecutionStep(index, { objective: event.target.value })}
                      rows={3}
                    />
                  </div>
                  <Field label="任务">
                    <Textarea
                      value={step.tasks.join("\n")}
                      onChange={(event) => updateExecutionStep(index, { tasks: lines(event.target.value) })}
                      rows={6}
                    />
                  </Field>
                  <Field label="交付物">
                    <Textarea
                      value={step.deliverables.join("\n")}
                      onChange={(event) =>
                        updateExecutionStep(index, { deliverables: lines(event.target.value) })
                      }
                      rows={6}
                    />
                  </Field>
                  <Field label="依赖">
                    <Textarea
                      value={step.estimatedDependencies.join("\n")}
                      onChange={(event) =>
                        updateExecutionStep(index, { estimatedDependencies: lines(event.target.value) })
                      }
                      rows={6}
                    />
                  </Field>
                </div>
              ))}
            </CardContent>
          </Card>

          {prompt && (
            <Card className="border-[#ffb28b]/20 bg-[#ffb28b]/[0.035]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4 text-[#ffb28b]" />
                  AI 生图提示词
                </CardTitle>
                <CardDescription>{prompt.name} · 可选内容，不影响直接导出项目计划。</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <div>
                  <Label className="mb-2 block text-xs">中文</Label>
                  <Textarea value={prompt.data.promptCN} readOnly rows={8} />
                </div>
                <div>
                  <Label className="mb-2 block text-xs">English</Label>
                  <Textarea value={prompt.data.promptEN} readOnly rows={8} />
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-white/[0.08] bg-white/[0.025]">
            <CardHeader>
              <CardTitle className="text-base">计划版本</CardTitle>
              <CardDescription>恢复、复制和标记最终版本。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {project.planVersions.length === 0 && <p className="text-xs text-slate-600">尚未保存版本。</p>}
              {project.planVersions.map((version) => (
                <div
                  key={version.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-xs text-slate-300">{version.name}</p>
                      {version.isFinal && <CheckCircle2 className="size-3.5 text-[#a8ffcb]" />}
                    </div>
                    <p className="mt-1 font-mono text-[8px] text-slate-600">
                      {new Date(version.createdAt).toLocaleString("zh-CN")}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="恢复"
                      onClick={() => restorePlanVersion(version.id)}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="标记最终版"
                      onClick={() => markFinalPlanVersion(version.id)}
                    >
                      <CheckCircle2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}

function lines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-slate-500">{label}</Label>
      {children}
    </div>
  );
}
