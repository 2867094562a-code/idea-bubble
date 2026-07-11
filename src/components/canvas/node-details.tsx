"use client";

import { ChevronDown, ChevronUp, Layers3, Lock, Sparkles, Trash2, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { Project } from "@/lib/domain";
import { useIdeaStore } from "@/store/idea-store";

export function NodeDetails({
  project,
  onExpand,
}: {
  project: Project;
  onExpand: (word: string, id: string) => void;
}) {
  const selectedNodeId = useIdeaStore((state) => state.selectedNodeId);
  const updateNode = useIdeaStore((state) => state.updateNode);
  const toggleLock = useIdeaStore((state) => state.toggleLock);
  const toggleCollapse = useIdeaStore((state) => state.toggleCollapse);
  const deleteNode = useIdeaStore((state) => state.deleteNode);
  const busyTask = useIdeaStore((state) => state.busyTask);
  const node = project.nodes.find((candidate) => candidate.id === selectedNodeId);

  if (!node) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-slate-500">
          <Layers3 className="size-5" />
        </div>
        <p className="text-sm font-medium text-slate-300">选择一个气泡</p>
        <p className="mt-2 text-xs leading-5 text-slate-600">
          查看它为什么出现、来自哪里，并继续编辑或发散。
        </p>
      </div>
    );
  }

  const parent = project.nodes.find((candidate) => candidate.id === node.parentId);
  const asset = project.assets.find((candidate) => candidate.id === node.sourceAssetId);
  const hasChildren = project.nodes.some((candidate) => candidate.parentId === node.id);
  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 p-4 pt-12 lg:pt-4">
        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <Badge variant="outline" className="border-white/10 font-mono text-[9px] text-slate-400">
              {node.category}
            </Badge>
            {node.collected && <Badge className="bg-[#a8ffcb]/10 text-[#a8ffcb]">已收集</Badge>}
          </div>
          <Input
            value={node.word}
            onChange={(event) => updateNode(node.id, { word: event.target.value })}
            className="h-auto border-0 bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
          />
        </div>
        <Separator />
        <DetailField label="分类">
          <Input
            value={node.category}
            onChange={(event) => updateNode(node.id, { category: event.target.value })}
          />
        </DetailField>
        <DetailField label="关联原因">
          <Textarea
            value={node.reason}
            onChange={(event) => updateNode(node.id, { reason: event.target.value })}
            rows={4}
          />
        </DetailField>
        <DetailField label="视觉提示">
          <Textarea
            value={node.visualHint}
            onChange={(event) => updateNode(node.id, { visualHint: event.target.value })}
            rows={3}
          />
        </DetailField>
        <div>
          <div className="mb-2 flex items-center justify-between text-xs">
            <Label>相关度</Label>
            <span className="font-mono text-[#a8ffcb]">{Math.round(node.relevance * 100)}%</span>
          </div>
          <Progress value={node.relevance * 100} className="h-1.5" />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-xs leading-5 text-slate-400">
          <p>
            <span className="text-slate-600">来源节点：</span>
            {parent?.word || "用户原始输入"}
          </p>
          <p>
            <span className="text-slate-600">来源素材：</span>
            {asset?.name || "文字灵感"}
          </p>
          <p>
            <span className="text-slate-600">展开层级：</span>
            {node.depth}
          </p>
        </div>
        <Button
          className="w-full bg-[#a8ffcb] text-[#07120d] hover:bg-[#91efb7]"
          disabled={Boolean(busyTask)}
          onClick={() => onExpand(node.word, node.id)}
        >
          <Sparkles className="size-4" />
          继续发散 10 个方向
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => toggleLock(node.id)}>
            <Lock className="size-3.5" />
            {node.locked ? "解锁" : "锁定"}
          </Button>
          {hasChildren && (
            <Button variant="outline" size="sm" onClick={() => toggleCollapse(node.id)}>
              {node.collapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
              {node.collapsed ? "展开" : "收起"}
            </Button>
          )}
          <Button variant="outline" size="sm" className="text-red-300" onClick={() => deleteNode(node.id)}>
            <Trash2 className="size-3.5" />
            删节点
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-300"
            onClick={() => deleteNode(node.id, true)}
          >
            <Unplug className="size-3.5" />
            删分支
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-slate-400">{label}</Label>
      {children}
    </div>
  );
}
