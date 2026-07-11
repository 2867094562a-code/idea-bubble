"use client";

import type { CSSProperties } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Lock,
  LockOpen,
  MoreHorizontal,
  Sparkles,
  Trash2,
  Unplug,
} from "lucide-react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { InspirationNode } from "@/lib/domain";
import { cn } from "@/lib/utils";

export interface BubbleNodeData extends Record<string, unknown> {
  node: InspirationNode;
  animationIndex: number;
  busy: boolean;
  hasChildren: boolean;
  reduceEffects: boolean;
  onSurfacePointerDown: (id: string, clientX: number, clientY: number) => void;
  onExpand: (id: string) => void;
  onToggleCollect: (id: string) => void;
  onToggleLock: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onDelete: (id: string, branch?: boolean) => void;
}

export type BubbleFlowNode = Node<BubbleNodeData, "bubble">;

const toneByCategory: Record<string, string> = {
  原始灵感: "bubble-tone-root",
  结构: "bubble-tone-mint",
  形态: "bubble-tone-mint",
  功能: "bubble-tone-blue",
  体验: "bubble-tone-blue",
  材质: "bubble-tone-amber",
  工艺: "bubble-tone-amber",
  情绪: "bubble-tone-rose",
  氛围: "bubble-tone-rose",
  场景: "bubble-tone-violet",
  跨界: "bubble-tone-cyan",
  反向: "bubble-tone-orange",
};

export function BubbleNode({ data, selected }: NodeProps<BubbleFlowNode>) {
  const { node } = data;
  const size = node.depth === 0 ? 148 : Math.round(96 + node.relevance * 28);
  const style = {
    width: size,
    height: size,
    "--bubble-delay": `${Math.min(data.animationIndex * 78, 780)}ms`,
    "--float-delay": `${(data.animationIndex % 7) * -0.47}s`,
  } as CSSProperties;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={node.collected}
      aria-label={`${node.word}，${node.collected ? "已收集" : "未收集"}，按空格切换收集`}
      className="bubble-wrap group focus-visible:outline-none"
      style={style}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        data.onSurfacePointerDown(node.id, event.clientX, event.clientY);
      }}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          data.onToggleCollect(node.id);
        }
      }}
    >
      <Handle type="target" position={Position.Top} className="!size-1 !border-0 !bg-transparent" />
      <div
        className={cn(
          "bubble-surface flex size-full flex-col items-center justify-center rounded-full px-4 text-center select-none",
          toneByCategory[node.category] || "bubble-tone-neutral",
          selected && "bubble-selected",
          node.collected && "bubble-collected",
          node.locked && "bubble-locked",
          data.reduceEffects && "bubble-static",
        )}
      >
        <span className="mb-1 max-w-full truncate rounded-full border border-current/15 bg-black/10 px-2 py-0.5 font-mono text-[8px] tracking-wide uppercase opacity-70">
          {node.category}
        </span>
        <span
          className={cn(
            "max-w-full text-sm leading-tight font-semibold tracking-tight",
            node.depth === 0 && "text-lg",
          )}
        >
          {node.word}
        </span>
        <span className="mt-1 font-mono text-[8px] opacity-45">{Math.round(node.relevance * 100)}%</span>
        {node.collected && (
          <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full border border-white/25 bg-[#08110d]/75 text-[#a8ffcb] shadow-lg">
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        )}
      </div>

      <Button
        type="button"
        size="icon-sm"
        variant="secondary"
        title="继续发散"
        aria-label={`继续发散：${node.word}`}
        disabled={data.busy}
        className="bubble-action nodrag absolute -right-1 bottom-2 size-7 rounded-full border border-white/15 bg-[#111a28] text-[#a8ffcb] opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          data.onExpand(node.id);
        }}
      >
        <Sparkles className="size-3.5" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`更多操作：${node.word}`}
            className="nodrag absolute top-2 -right-1 size-7 rounded-full border border-white/10 bg-[#0c1320]/90 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-44" onClick={(event) => event.stopPropagation()}>
          <DropdownMenuItem disabled={data.busy} onClick={() => data.onExpand(node.id)}>
            <Sparkles />
            继续发散
          </DropdownMenuItem>
          {data.hasChildren && (
            <DropdownMenuItem onClick={() => data.onToggleCollapse(node.id)}>
              {node.collapsed ? <ChevronDown /> : <ChevronUp />}
              {node.collapsed ? "展开分支" : "收起分支"}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => data.onToggleLock(node.id)}>
            {node.locked ? <LockOpen /> : <Lock />}
            {node.locked ? "解锁" : "锁定"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-red-300" onClick={() => data.onDelete(node.id)}>
            <Trash2 />
            删除节点
          </DropdownMenuItem>
          <DropdownMenuItem className="text-red-300" onClick={() => data.onDelete(node.id, true)}>
            <Unplug />
            删除整个分支
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Handle type="source" position={Position.Bottom} className="!size-1 !border-0 !bg-transparent" />
    </div>
  );
}
