"use client";

import { useState } from "react";
import { Lightbulb, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectInfo, ProjectType } from "@/lib/domain";

const projectTypes: ProjectType[] = [
  "鞋类设计",
  "产品设计",
  "品牌设计",
  "平面视觉",
  "视频创意",
  "通用头脑风暴",
  "自定义",
];

const initialInfo: ProjectInfo = {
  name: "",
  designObject: "",
  type: "通用头脑风暴",
  customType: "",
  goal: "",
  audience: "",
  scenario: "",
  requirements: "",
  forbiddenElements: "",
};

export function ProjectWizard({
  open,
  required = false,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  required?: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (info: ProjectInfo) => void;
}) {
  const [info, setInfo] = useState<ProjectInfo>(initialInfo);

  const update = <K extends keyof ProjectInfo>(field: K, value: ProjectInfo[K]) => {
    setInfo((current) => ({ ...current, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !required && onOpenChange(next)}>
      <DialogContent
        className="max-h-[92vh] overflow-y-auto border-white/10 bg-[#0d1422] p-0 text-white sm:max-w-3xl"
        showCloseButton={!required}
        onOpenAutoFocus={() => setInfo(initialInfo)}
      >
        <div className="grid md:grid-cols-[0.72fr_1.28fr]">
          <div className="relative overflow-hidden border-b border-white/10 bg-[#111c30] p-7 md:border-r md:border-b-0">
            <div className="absolute -top-12 -left-12 size-40 rounded-full bg-[#a8ffcb]/10 blur-3xl" />
            <div className="relative flex h-full flex-col justify-between gap-10">
              <div>
                <div className="mb-5 flex size-11 items-center justify-center rounded-2xl border border-[#a8ffcb]/30 bg-[#a8ffcb]/10 text-[#a8ffcb]">
                  <Lightbulb className="size-5" />
                </div>
                <p className="font-mono text-[11px] tracking-[0.22em] text-[#a8ffcb] uppercase">
                  New thinking space
                </p>
                <DialogHeader className="mt-3 text-left">
                  <DialogTitle className="text-3xl leading-tight font-medium tracking-tight">
                    先给灵感一个方向
                  </DialogTitle>
                  <DialogDescription className="mt-3 leading-6 text-slate-400">
                    这些信息会约束后续发散、总结和项目计划，但不会替你做选择。
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-xs leading-5 text-slate-400">
                <Sparkles className="mb-2 size-4 text-[#ffb28b]" />
                新用户默认使用 Mock，创建项目后可在模型设置中填写自己的 Key 与模型。
              </div>
            </div>
          </div>

          <form
            className="space-y-5 p-6 md:p-8"
            onSubmit={(event) => {
              event.preventDefault();
              if (!info.name.trim() || !info.designObject.trim()) return;
              onCreate({ ...info, name: info.name.trim(), designObject: info.designObject.trim() });
              onOpenChange(false);
            }}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="项目名称" required>
                <Input
                  autoFocus
                  value={info.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder="例如：蜂巢城市通勤鞋"
                  maxLength={80}
                />
              </Field>
              <Field label="项目类型">
                <Select value={info.type} onValueChange={(value) => update("type", value as ProjectType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {projectTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="要设计的物品" required>
              <Input
                value={info.designObject}
                onChange={(event) => update("designObject", event.target.value)}
                placeholder="例如：城市通勤鞋、桌面台灯、保温杯"
                maxLength={120}
              />
              <p className="text-[11px] leading-4 text-slate-500">
                用于最终生图提示词的主体判断；创建后仍可随时修改。
              </p>
            </Field>
            {info.type === "自定义" && (
              <Field label="自定义类型">
                <Input
                  value={info.customType}
                  onChange={(event) => update("customType", event.target.value)}
                  placeholder="输入你的项目类型"
                />
              </Field>
            )}
            <Field label="项目目标">
              <Textarea
                value={info.goal}
                onChange={(event) => update("goal", event.target.value)}
                placeholder="希望最终解决什么问题？"
                rows={2}
                maxLength={500}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="目标人群">
                <Input
                  value={info.audience}
                  onChange={(event) => update("audience", event.target.value)}
                  placeholder="谁会使用它？"
                />
              </Field>
              <Field label="使用场景">
                <Input
                  value={info.scenario}
                  onChange={(event) => update("scenario", event.target.value)}
                  placeholder="在什么情境中？"
                />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="补充要求">
                <Textarea
                  value={info.requirements}
                  onChange={(event) => update("requirements", event.target.value)}
                  placeholder="材料、预算、调性……"
                  rows={3}
                />
              </Field>
              <Field label="禁止元素">
                <Textarea
                  value={info.forbiddenElements}
                  onChange={(event) => update("forbiddenElements", event.target.value)}
                  placeholder="明确不想出现的内容"
                  rows={3}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              {!required && (
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  取消
                </Button>
              )}
              <Button
                type="submit"
                disabled={!info.name.trim() || !info.designObject.trim()}
                className="bg-[#a8ffcb] text-[#07120d] hover:bg-[#91efb7]"
              >
                创建灵感空间
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-slate-300">
        {label}
        {required && <span className="ml-1 text-[#ff9d73]">*</span>}
      </Label>
      {children}
    </div>
  );
}
