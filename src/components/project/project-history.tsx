"use client";

import { useRef, useState } from "react";
import { Copy, Download, FolderClock, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { projectRepository } from "@/lib/repository";
import type { Project } from "@/lib/domain";
import { useIdeaStore } from "@/store/idea-store";

export function ProjectHistory({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const loadProject = useIdeaStore((state) => state.loadProject);
  const deleteProject = useIdeaStore((state) => state.deleteProject);
  const current = useIdeaStore((state) => state.project);

  const refresh = async () => {
    const all = await projectRepository.list();
    setProjects(all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  };

  const duplicate = async (project: Project) => {
    const now = new Date().toISOString();
    const copy: Project = structuredClone(project);
    copy.id = crypto.randomUUID();
    copy.info.name = `${copy.info.name}（副本）`;
    copy.createdAt = now;
    copy.updatedAt = now;
    await projectRepository.save(copy);
    await refresh();
  };

  const exportBackup = (project: Project) => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.info.name.replace(/[\\/:*?"<>|]/g, "_")}_完整备份.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Project;
      if (!parsed.id || !parsed.info?.name || !Array.isArray(parsed.nodes)) throw new Error();
      parsed.id = crypto.randomUUID();
      parsed.info.name = `${parsed.info.name}（已恢复）`;
      parsed.updatedAt = new Date().toISOString();
      await projectRepository.save(parsed);
      await refresh();
    } catch {
      window.alert("备份文件无效，未修改任何项目。");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="border-white/10 bg-[#0d1422] text-white sm:max-w-2xl"
        onOpenAutoFocus={() => void refresh()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderClock className="size-5 text-[#a8ffcb]" />
            项目历史
          </DialogTitle>
          <DialogDescription>所有项目都保存在当前浏览器的 IndexedDB 中。</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            恢复备份
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void importBackup(event.target.files?.[0])}
          />
        </div>
        <ScrollArea className="max-h-[56vh] pr-3">
          <div className="space-y-2">
            {projects.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-500">
                还没有保存的项目
              </div>
            )}
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
              >
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    loadProject(project);
                    onOpenChange(false);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{project.info.name}</span>
                    {project.id === current?.id && (
                      <Badge variant="outline" className="border-[#a8ffcb]/30 text-[#a8ffcb]">
                        当前
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-slate-500">
                    {project.nodes.length} 气泡 · {new Date(project.updatedAt).toLocaleString("zh-CN")}
                  </p>
                </button>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    title="导出完整备份"
                    onClick={() => exportBackup(project)}
                  >
                    <Download className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    title="复制项目"
                    onClick={() => void duplicate(project)}
                  >
                    <Copy className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    title="删除项目"
                    className="text-slate-500 hover:text-red-400"
                    onClick={async () => {
                      if (!window.confirm(`确定删除“${project.info.name}”吗？此操作不可撤销。`)) return;
                      await deleteProject(project.id);
                      await refresh();
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
