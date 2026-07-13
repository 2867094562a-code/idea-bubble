"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  LoaderCircle,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  MousePointer2,
  Sparkles,
} from "lucide-react";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Edge,
  type ReactFlowInstance,
} from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/domain";
import { useIdeaStore } from "@/store/idea-store";
import { BubbleNode, type BubbleFlowNode } from "@/components/canvas/bubble-node";

const nodeTypes = { bubble: BubbleNode };
const SINGLE_CLICK_DELAY_MS = 320;
const DOUBLE_CLICK_WINDOW_MS = 600;
const HIGH_DENSITY_THRESHOLD = 60;

interface CollectionFlight {
  id: string;
  word: string;
  left: number;
  top: number;
  tx: number;
  ty: number;
}

interface PendingNodeClick {
  nodeId: string;
  clientX: number;
  clientY: number;
  pressedAt: number;
  timer: ReturnType<typeof setTimeout>;
}

export function InspirationCanvas({
  project,
  onExpand,
}: {
  project: Project;
  onExpand: (word: string, parentId: string) => void;
}) {
  const selectedNodeId = useIdeaStore((state) => state.selectedNodeId);
  const setSelectedNode = useIdeaStore((state) => state.setSelectedNode);
  const toggleCollect = useIdeaStore((state) => state.toggleCollect);
  const moveNode = useIdeaStore((state) => state.moveNode);
  const toggleLock = useIdeaStore((state) => state.toggleLock);
  const toggleCollapse = useIdeaStore((state) => state.toggleCollapse);
  const deleteNode = useIdeaStore((state) => state.deleteNode);
  const busyTask = useIdeaStore((state) => state.busyTask);
  const pendingClick = useRef<PendingNodeClick | undefined>(undefined);
  const recentlyAppliedClick = useRef<
    | {
        nodeId: string;
        previousCollected: boolean;
        appliedAt: number;
        pressedAt: number;
      }
    | undefined
  >(undefined);
  const lastDoubleExpansion = useRef<
    | {
        nodeId: string;
        expandedAt: number;
      }
    | undefined
  >(undefined);
  const surfaceClickHandler = useRef<(nodeId: string, clientX: number, clientY: number) => void>(
    () => undefined,
  );
  const flowRef = useRef<ReactFlowInstance<BubbleFlowNode, Edge> | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const previousNodeCount = useRef(project.nodes.length);
  const [flights, setFlights] = useState<CollectionFlight[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(
    () => () => {
      if (pendingClick.current) clearTimeout(pendingClick.current.timer);
    },
    [],
  );

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === canvasRef.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await canvasRef.current?.requestFullscreen();
      window.setTimeout(() => void flowRef.current?.fitView({ padding: 0.18, duration: 220 }), 60);
    } catch {
      // Fullscreen may be disabled by the host browser; the normal canvas stays usable.
    }
  }, []);

  useEffect(() => {
    const previous = previousNodeCount.current;
    previousNodeCount.current = project.nodes.length;
    if (project.nodes.length <= previous || !flowRef.current) return;
    const timer = window.setTimeout(() => {
      void flowRef.current?.fitView({
        padding: 0.32,
        maxZoom: 1.1,
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 320,
      });
    }, 40);
    return () => window.clearTimeout(timer);
  }, [project.nodes.length]);

  const visibleIds = useMemo(() => {
    const visible = new Set<string>();
    const byId = new Map(project.nodes.map((node) => [node.id, node]));
    project.nodes.forEach((node) => {
      let parentId = node.parentId;
      let hidden = false;
      while (parentId) {
        const parent = byId.get(parentId);
        if (!parent) break;
        if (parent.collapsed) {
          hidden = true;
          break;
        }
        parentId = parent.parentId;
      }
      if (!hidden) visible.add(node.id);
    });
    return visible;
  }, [project.nodes]);

  const siblingIndexById = useMemo(() => {
    const counts = new Map<string, number>();
    const indexes = new Map<string, number>();
    project.nodes.forEach((node) => {
      const key = node.parentId || "__root__";
      const index = counts.get(key) || 0;
      indexes.set(node.id, index);
      counts.set(key, index + 1);
    });
    return indexes;
  }, [project.nodes]);

  const parentIds = useMemo(
    () => new Set(project.nodes.flatMap((node) => (node.parentId ? [node.parentId] : []))),
    [project.nodes],
  );

  const selectedNode = useMemo(
    () => project.nodes.find((node) => node.id === selectedNodeId),
    [project.nodes, selectedNodeId],
  );

  const nodes = useMemo<BubbleFlowNode[]>(
    () =>
      project.nodes
        .filter((node) => visibleIds.has(node.id))
        .map((node) => ({
          id: node.id,
          type: "bubble",
          position: node.position,
          selected: node.id === selectedNodeId,
          draggable: !node.locked,
          data: {
            node,
            animationIndex: (siblingIndexById.get(node.id) || 0) % 10,
            busy: Boolean(busyTask),
            hasChildren: parentIds.has(node.id),
            reduceEffects: project.nodes.length > HIGH_DENSITY_THRESHOLD,
            onSurfacePointerDown: (id: string, clientX: number, clientY: number) =>
              surfaceClickHandler.current(id, clientX, clientY),
            onExpand: (id: string) => {
              const source = project.nodes.find((candidate) => candidate.id === id);
              if (source) onExpand(source.word, source.id);
            },
            onToggleCollect: toggleCollect,
            onToggleLock: toggleLock,
            onToggleCollapse: toggleCollapse,
            onDelete: deleteNode,
          },
        })),
    [
      busyTask,
      deleteNode,
      onExpand,
      parentIds,
      project.nodes,
      selectedNodeId,
      siblingIndexById,
      toggleCollect,
      toggleCollapse,
      toggleLock,
      visibleIds,
    ],
  );

  const edges = useMemo<Edge[]>(
    () =>
      project.edges
        .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
        .map((edge) => ({
          ...edge,
          type: "smoothstep",
          animated: false,
          style: { stroke: "rgba(172, 194, 220, .18)", strokeWidth: 1.25 },
        })),
    [project.edges, visibleIds],
  );

  const applySingleClick = useCallback(
    (click: Omit<PendingNodeClick, "timer">) => {
      const node = useIdeaStore.getState().project?.nodes.find((candidate) => candidate.id === click.nodeId);
      if (!node) return;
      setSelectedNode(click.nodeId);
      const previousCollected = node.collected;
      if (!previousCollected && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const flight: CollectionFlight = {
          id: crypto.randomUUID(),
          word: node.word,
          left: click.clientX - 34,
          top: click.clientY - 34,
          tx: window.innerWidth / 2 - click.clientX,
          ty: window.innerHeight - 80 - click.clientY,
        };
        setFlights((current) => [...current, flight].slice(-8));
        window.setTimeout(
          () => setFlights((current) => current.filter((candidate) => candidate.id !== flight.id)),
          430,
        );
      }
      toggleCollect(click.nodeId);
      recentlyAppliedClick.current = {
        nodeId: click.nodeId,
        previousCollected,
        appliedAt: Date.now(),
        pressedAt: click.pressedAt,
      };
    },
    [setFlights, setSelectedNode, toggleCollect],
  );

  const expandFromDoubleClick = useCallback(
    (nodeId: string) => {
      const now = Date.now();
      const lastExpansion = lastDoubleExpansion.current;
      if (lastExpansion?.nodeId === nodeId && now - lastExpansion.expandedAt < 650) return;

      if (pendingClick.current?.nodeId === nodeId) {
        clearTimeout(pendingClick.current.timer);
        pendingClick.current = undefined;
      }

      const applied = recentlyAppliedClick.current;
      if (applied?.nodeId === nodeId && now - applied.appliedAt < 900) {
        const currentNode = useIdeaStore
          .getState()
          .project?.nodes.find((candidate) => candidate.id === nodeId);
        if (currentNode && currentNode.collected !== applied.previousCollected) toggleCollect(nodeId);
        recentlyAppliedClick.current = undefined;
      }

      const source = useIdeaStore.getState().project?.nodes.find((candidate) => candidate.id === nodeId);
      if (!source) return;
      lastDoubleExpansion.current = { nodeId, expandedAt: now };
      setSelectedNode(source.id);
      onExpand(source.word, source.id);
    },
    [onExpand, setSelectedNode, toggleCollect],
  );

  const onSurfacePointerDown = useCallback(
    (nodeId: string, clientX: number, clientY: number) => {
      const now = Date.now();
      const current = pendingClick.current;
      const recentlyApplied = recentlyAppliedClick.current;
      const isSecondClickOnSameNode =
        (current?.nodeId === nodeId && now - current.pressedAt <= DOUBLE_CLICK_WINDOW_MS) ||
        (!current &&
          recentlyApplied?.nodeId === nodeId &&
          now - recentlyApplied.pressedAt <= DOUBLE_CLICK_WINDOW_MS);
      if (current) {
        clearTimeout(current.timer);
        pendingClick.current = undefined;
        if (current.nodeId !== nodeId) applySingleClick(current);
      }
      if (isSecondClickOnSameNode) {
        // Expand on the second click itself. React Flow can move a node while fitting
        // the canvas, causing the browser's final dblclick event to land on the pane.
        expandFromDoubleClick(nodeId);
        return;
      }

      const click = {
        nodeId,
        clientX,
        clientY,
        pressedAt: now,
      };
      const timer = setTimeout(() => {
        if (pendingClick.current?.nodeId !== click.nodeId) return;
        pendingClick.current = undefined;
        applySingleClick(click);
      }, SINGLE_CLICK_DELAY_MS);
      pendingClick.current = { ...click, timer };
    },
    [applySingleClick, expandFromDoubleClick],
  );

  useEffect(() => {
    surfaceClickHandler.current = onSurfacePointerDown;
  }, [onSurfacePointerDown]);

  return (
    <div ref={canvasRef} className="relative size-full min-h-[430px] overflow-hidden bg-[#09111d]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-white/10 bg-[#09111d]/80 font-mono text-[9px] text-slate-400 backdrop-blur"
          >
            DEPTH {Math.max(0, ...project.nodes.map((node) => node.depth))}
          </Badge>
          <Badge
            variant="outline"
            className="border-white/10 bg-[#09111d]/80 font-mono text-[9px] text-slate-400 backdrop-blur"
          >
            {project.nodes.length}/200 NODES
          </Badge>
        </div>
        {busyTask === "expand" && (
          <div className="flex items-center gap-2 rounded-full border border-[#a8ffcb]/15 bg-[#0b1720]/90 px-3 py-1.5 text-[11px] text-[#a8ffcb] backdrop-blur">
            <LoaderCircle className="size-3.5 animate-spin" />
            正在寻找十个新方向
          </div>
        )}
      </div>

      {isFullscreen && project.nodes.length > 0 && (
        <div className="pointer-events-none absolute top-4 left-1/2 z-20 w-[min(30rem,calc(100%-2rem))] -translate-x-1/2">
          <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0a111c]/95 px-3 py-2 shadow-xl backdrop-blur">
            <div className="min-w-0">
              <p className="text-[10px] text-slate-500">沉浸式发散</p>
              <p className="truncate text-xs text-slate-200">
                {selectedNode ? `以「${selectedNode.word}」为起点` : "先单击选择一个气泡"}
              </p>
            </div>
            <Button
              size="sm"
              className="shrink-0 bg-[#a8ffcb] text-[#07120d] hover:bg-[#91efb7]"
              disabled={!selectedNode || Boolean(busyTask)}
              onClick={() => selectedNode && onExpand(selectedNode.word, selectedNode.id)}
            >
              {busyTask === "expand" ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              生成 10 个气泡
            </Button>
          </div>
        </div>
      )}

      <ReactFlow<BubbleFlowNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1.2 }}
        minZoom={0.25}
        maxZoom={1.8}
        autoPanOnNodeFocus={false}
        zoomOnDoubleClick={false}
        elementsSelectable={false}
        nodesConnectable={false}
        onlyRenderVisibleElements={project.nodes.length > HIGH_DENSITY_THRESHOLD}
        proOptions={{ hideAttribution: true }}
        onInit={(instance) => {
          flowRef.current = instance;
        }}
        onPaneClick={(event) => {
          const pending = pendingClick.current;
          const applied = recentlyAppliedClick.current;
          const lastExpansion = lastDoubleExpansion.current;
          if (event.detail > 1 && lastExpansion && Date.now() - lastExpansion.expandedAt < 900) return;
          const doubleClickNodeId =
            pending?.nodeId || (applied && Date.now() - applied.appliedAt < 900 ? applied.nodeId : undefined);
          if (event.detail > 1 && doubleClickNodeId) {
            expandFromDoubleClick(doubleClickNodeId);
            return;
          }
          setSelectedNode(undefined);
        }}
        onNodeDragStart={(_event, flowNode) => {
          if (pendingClick.current?.nodeId !== flowNode.id) return;
          clearTimeout(pendingClick.current.timer);
          pendingClick.current = undefined;
        }}
        onNodeDragStop={(_event, flowNode) => moveNode(flowNode.id, flowNode.position)}
        className="idea-flow"
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="rgba(166,190,218,.14)" />
        <Controls
          position="bottom-left"
          className="!bottom-32 !overflow-hidden !rounded-xl !border-white/10 !bg-[#111926] !fill-slate-300 !shadow-xl"
        />
      </ReactFlow>

      <CanvasOverview
        nodes={nodes}
        selectedNodeId={selectedNodeId}
        onNavigate={(x, y) => void flowRef.current?.setCenter(x, y, { zoom: 0.8, duration: 260 })}
        isFullscreen={isFullscreen}
        onFullscreenToggle={() => void toggleFullscreen()}
      />

      {project.nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
          <div className="max-w-sm text-center">
            <div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-full border border-dashed border-[#a8ffcb]/25 bg-[#a8ffcb]/[0.035] text-[#a8ffcb]">
              <Brain className="size-8" strokeWidth={1.4} />
            </div>
            <p className="text-lg font-medium text-slate-200">画布正在等第一个念头</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              在左侧输入一个词、一句话或一段简短说明。AI 会从十个不同维度展开。
            </p>
            <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-slate-600">
              <MousePointer2 className="size-3.5" />
              单击收集 · 双击继续发散
            </div>
          </div>
        </div>
      )}

      {flights.map((flight) => (
        <div
          key={flight.id}
          data-flight-id={flight.id}
          data-flight-word={flight.word}
          className="collection-flight pointer-events-none fixed z-[100] flex size-16 items-center justify-center rounded-full border border-[#a8ffcb]/35 bg-[#a8ffcb]/20 px-2 text-center text-[10px] font-semibold text-[#d8ffe7] shadow-2xl backdrop-blur"
          style={
            {
              left: flight.left,
              top: flight.top,
              "--flight-x": `${flight.tx}px`,
              "--flight-y": `${flight.ty}px`,
            } as React.CSSProperties
          }
        >
          <Sparkles className="absolute -top-1 -right-1 size-3 text-[#a8ffcb]" />
          {flight.word}
        </div>
      ))}
    </div>
  );
}

function CanvasOverview({
  nodes,
  selectedNodeId,
  onNavigate,
  isFullscreen,
  onFullscreenToggle,
}: {
  nodes: BubbleFlowNode[];
  selectedNodeId?: string;
  onNavigate: (x: number, y: number) => void;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
}) {
  const extent = nodes.reduce(
    (value, node) => ({
      minX: Math.min(value.minX, node.position.x),
      maxX: Math.max(value.maxX, node.position.x),
      minY: Math.min(value.minY, node.position.y),
      maxY: Math.max(value.maxY, node.position.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
  const width = Math.max(1, extent.maxX - extent.minX);
  const height = Math.max(1, extent.maxY - extent.minY);

  return (
    <div className="absolute right-3 bottom-32 z-20 w-32 overflow-hidden rounded-xl border border-white/10 bg-[#0a111c]/95 shadow-xl backdrop-blur">
      <button
        type="button"
        aria-label="在总览中定位画布"
        className="relative block h-20 w-full cursor-crosshair bg-[radial-gradient(circle_at_1px_1px,rgba(172,194,220,.16)_1px,transparent_0)] bg-[size:10px_10px]"
        onClick={(event) => {
          if (!nodes.length) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const ratioX = (event.clientX - rect.left) / rect.width;
          const ratioY = (event.clientY - rect.top) / rect.height;
          onNavigate(extent.minX + width * ratioX, extent.minY + height * ratioY);
        }}
      >
        {nodes.map((node) => (
          <span
            key={node.id}
            className={
              node.id === selectedNodeId
                ? "absolute size-2 rounded-full bg-[#a8ffcb] shadow-[0_0_8px_#a8ffcb]"
                : "absolute size-1.5 rounded-full bg-slate-400/80"
            }
            style={{
              left: `${8 + ((node.position.x - extent.minX) / width) * 84}%`,
              top: `${8 + ((node.position.y - extent.minY) / height) * 84}%`,
            }}
          />
        ))}
        {!nodes.length && <MapIcon className="absolute inset-0 m-auto size-4 text-slate-600" />}
      </button>
      <button
        type="button"
        onClick={onFullscreenToggle}
        className="flex h-8 w-full items-center justify-center gap-1.5 border-t border-white/10 text-[10px] text-slate-300 transition-colors hover:bg-white/[0.06]"
      >
        {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        {isFullscreen ? "退出沉浸" : "沉浸思考"}
      </button>
    </div>
  );
}
