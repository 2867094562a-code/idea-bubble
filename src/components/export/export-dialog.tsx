"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  Eye,
  FileArchive,
  FileJson,
  FileText,
  LoaderCircle,
  RefreshCcw,
  Save,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createDefaultExportPreset } from "@/lib/defaults";
import type { ExportFormat, ExportPreset, ExportSectionId, Project } from "@/lib/domain";
import { buildExportRequestBody } from "@/lib/export/client-request";
import type { ExportBlock, ExportDocument } from "@/lib/export/types";
import { cn } from "@/lib/utils";
import { useIdeaStore } from "@/store/idea-store";

const formats: Array<{ id: ExportFormat; label: string; required?: boolean; icon: typeof FileText }> = [
  { id: "docx", label: "DOCX", required: true, icon: FileArchive },
  { id: "pdf", label: "PDF", required: true, icon: FileText },
  { id: "txt", label: "TXT", required: true, icon: FileText },
  { id: "markdown", label: "Markdown", icon: FileText },
  { id: "json", label: "JSON", icon: FileJson },
];

const sectionLabels: Array<{ id: ExportSectionId; label: string }> = [
  { id: "cover", label: "项目封面" },
  { id: "projectInfo", label: "项目基本信息" },
  { id: "originalInput", label: "原始输入" },
  { id: "assets", label: "素材缩略图" },
  { id: "allIdeas", label: "灵感气泡列表" },
  { id: "relationships", label: "灵感关系说明" },
  { id: "collectedIdeas", label: "已收集灵感" },
  { id: "concept", label: "创意总结" },
  { id: "plan", label: "完整项目计划" },
  { id: "execution", label: "执行步骤" },
  { id: "risks", label: "风险与验证" },
  { id: "imagePrompt", label: "AI 生图提示词" },
  { id: "version", label: "版本信息" },
  { id: "exportedAt", label: "导出时间" },
];

type FormatState = "idle" | "generating" | "done" | "error";
type DownloadResult = { blob: Blob; fileName: string };

export function ExportDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
}) {
  const saveExportPreset = useIdeaStore((state) => state.saveExportPreset);
  const [preset, setPreset] = useState<ExportPreset>(() =>
    structuredClone(project.exportPresets[0] || createDefaultExportPreset()),
  );
  const [fileName, setFileName] = useState("");
  const [exportedAt, setExportedAt] = useState(() => new Date().toISOString());
  const [preview, setPreview] = useState<ExportDocument>();
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [previewError, setPreviewError] = useState<string>();
  const [previewing, setPreviewing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState<Partial<Record<ExportFormat, FormatState>>>({});
  const [errors, setErrors] = useState<Partial<Record<ExportFormat, string>>>({});
  const [downloads, setDownloads] = useState<Partial<Record<ExportFormat, DownloadResult>>>({});
  const abortRef = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    const base = structuredClone(project.exportPresets[0] || createDefaultExportPreset());
    setPreset(base);
    setFileName(base.fileName || "");
    setExportedAt(new Date().toISOString());
    setStatus({});
    setErrors({});
    setDownloads({});
  }, [open, project.id, project.exportPresets]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPreviewing(true);
      setPreviewError(undefined);
      try {
        const body = buildExportRequestBody({
          project,
          preset,
          fileName,
          exportedAt,
          includeAssetData: false,
        });
        const response = await fetch("/api/export/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          data?: ExportDocument;
          fileNames?: Record<string, string>;
          error?: string;
        };
        if (!response.ok || !payload.data) throw new Error(payload.error || "预览生成失败");
        setPreview(payload.data);
        setFileNames(payload.fileNames || {});
      } catch (cause) {
        if (!controller.signal.aborted)
          setPreviewError(cause instanceof Error ? cause.message : "预览生成失败");
      } finally {
        if (!controller.signal.aborted) setPreviewing(false);
      }
    }, 280);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [exportedAt, fileName, open, preset, project]);

  const update = <K extends keyof ExportPreset>(key: K, value: ExportPreset[K]) =>
    setPreset((current) => ({ ...current, [key]: value }));
  const toggleFormat = (format: ExportFormat) =>
    update(
      "formats",
      preset.formats.includes(format)
        ? preset.formats.filter((item) => item !== format)
        : [...preset.formats, format],
    );
  const toggleSection = (section: ExportSectionId) =>
    update(
      "includedSections",
      preset.includedSections.includes(section)
        ? preset.includedSections.filter((item) => item !== section)
        : [...preset.includedSections, section],
    );

  const downloadBlob = (result: DownloadResult) => {
    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.fileName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const generateFormat = async (
    format: ExportFormat,
    controller: AbortController,
    batchExportedAt: string,
  ) => {
    setStatus((current) => ({ ...current, [format]: "generating" }));
    setErrors((current) => ({ ...current, [format]: undefined }));
    try {
      const body = buildExportRequestBody({
        project,
        preset,
        fileName,
        exportedAt: batchExportedAt,
        includeAssetData: true,
      });
      const response = await fetch(`/api/export/${format}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || `${format.toUpperCase()} 生成失败`);
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error("生成的文件为空");
      const disposition = response.headers.get("content-disposition");
      const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const fallback = fileNames[format] || `${project.info.name}.${format === "markdown" ? "md" : format}`;
      const result = { blob, fileName: encoded ? decodeURIComponent(encoded) : fallback };
      setDownloads((current) => ({ ...current, [format]: result }));
      setStatus((current) => ({ ...current, [format]: "done" }));
      downloadBlob(result);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setStatus((current) => ({ ...current, [format]: "error" }));
      setErrors((current) => ({ ...current, [format]: cause instanceof Error ? cause.message : "生成失败" }));
    }
  };

  const runExport = async (selected = preset.formats) => {
    if (exporting || selected.length === 0) return;
    const batchExportedAt = new Date().toISOString();
    setExportedAt(batchExportedAt);
    const controller = new AbortController();
    abortRef.current = controller;
    setExporting(true);
    await Promise.all(selected.map((format) => generateFormat(format, controller, batchExportedAt)));
    if (!controller.signal.aborted) setExporting(false);
  };

  const close = (next: boolean) => {
    if (!next && exporting) abortRef.current?.abort();
    setExporting(false);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="h-[92vh] max-h-[920px] overflow-hidden border-white/10 bg-[#0a111d] p-0 text-white sm:max-w-[min(1180px,96vw)]">
        <div className="grid h-full min-h-0 lg:grid-cols-[430px_1fr]">
          <section className="flex min-h-0 flex-col border-b border-white/10 bg-[#0d1422] lg:border-r lg:border-b-0">
            <DialogHeader className="border-b border-white/[0.07] p-5 text-left">
              <DialogTitle className="flex items-center gap-2">
                <Download className="size-5 text-[#a8ffcb]" />
                导出项目
              </DialogTitle>
              <DialogDescription>
                所有格式共享同一份 ExportDocument；导出不会修改原项目，也不会默认调用 AI。
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="min-h-0 flex-1">
              <Tabs defaultValue="content" className="p-4">
                <TabsList className="grid w-full grid-cols-3 bg-black/20">
                  <TabsTrigger value="content">内容</TabsTrigger>
                  <TabsTrigger value="layout">版式</TabsTrigger>
                  <TabsTrigger value="files">文件</TabsTrigger>
                </TabsList>
                <TabsContent value="content" className="mt-4 space-y-5">
                  <SettingSection title="文件格式" description="可一次选择多个格式并分别下载。">
                    <div className="grid grid-cols-3 gap-2">
                      {formats.map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleFormat(id)}
                          className={cn(
                            "flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border text-[10px] transition-colors",
                            preset.formats.includes(id)
                              ? "border-[#a8ffcb]/40 bg-[#a8ffcb]/[0.07] text-[#dfffea]"
                              : "border-white/10 bg-white/[0.02] text-slate-500",
                          )}
                        >
                          <Icon className="size-4" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </SettingSection>
                  <SettingSection title="导出范围" description="勾选顺序会保留为章节顺序。">
                    <div className="grid grid-cols-2 gap-2">
                      {sectionLabels
                        .filter((item) => item.id !== "imagePrompt" || project.imagePromptVersions.length > 0)
                        .map((section) => (
                          <label
                            key={section.id}
                            className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.07] p-2.5 text-[11px] text-slate-400"
                          >
                            <Checkbox
                              checked={preset.includedSections.includes(section.id)}
                              onCheckedChange={() => toggleSection(section.id)}
                            />
                            {section.label}
                          </label>
                        ))}
                    </div>
                  </SettingSection>
                  <SettingSection
                    title="补充导出要求"
                    description="首版保留并展示要求，不会伪装理解任意自然语言排版。"
                  >
                    <Textarea
                      value={preset.customRequirements}
                      onChange={(event) => update("customRequirements", event.target.value)}
                      placeholder="例如：使用正式项目报告格式，将灵感关键词放入附录。"
                      rows={5}
                    />
                  </SettingSection>
                </TabsContent>

                <TabsContent value="layout" className="mt-4 space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="报告风格">
                      <Select
                        value={preset.layout}
                        onValueChange={(value) => update("layout", value as ExportPreset["layout"])}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minimal">简洁报告</SelectItem>
                          <SelectItem value="business">正式商务</SelectItem>
                          <SelectItem value="creative">创意方案</SelectItem>
                          <SelectItem value="school">学校作业</SelectItem>
                          <SelectItem value="plain">纯文本</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="纸张方向">
                      <Select
                        value={preset.orientation}
                        onValueChange={(value) => update("orientation", value as ExportPreset["orientation"])}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="portrait">A4 纵向</SelectItem>
                          <SelectItem value="landscape">A4 横向</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <Field label="封面标题">
                    <Input
                      value={preset.coverTitle || ""}
                      onChange={(event) => update("coverTitle", event.target.value)}
                      placeholder={project.info.name}
                    />
                  </Field>
                  <Field label="副标题">
                    <Input
                      value={preset.subtitle || ""}
                      onChange={(event) => update("subtitle", event.target.value)}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="作者">
                      <Input
                        value={preset.author || ""}
                        onChange={(event) => update("author", event.target.value)}
                      />
                    </Field>
                    <Field label="单位 / 组织">
                      <Input
                        value={preset.organization || ""}
                        onChange={(event) => update("organization", event.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="版本名称">
                    <Input
                      value={preset.versionName || ""}
                      onChange={(event) => update("versionName", event.target.value)}
                    />
                  </Field>
                  <div className="space-y-2 rounded-xl border border-white/[0.08] p-3">
                    <SwitchRow
                      label="生成章节目录"
                      checked={preset.includeTableOfContents}
                      onChange={(value) => update("includeTableOfContents", value)}
                    />
                    <SwitchRow
                      label="显示页码"
                      checked={preset.includePageNumbers}
                      onChange={(value) => update("includePageNumbers", value)}
                    />
                    <SwitchRow
                      label="显示页眉"
                      checked={preset.includeHeader}
                      onChange={(value) => update("includeHeader", value)}
                    />
                    <SwitchRow
                      label="显示页脚"
                      checked={preset.includeFooter}
                      onChange={(value) => update("includeFooter", value)}
                    />
                    <SwitchRow
                      label="包含素材图片"
                      checked={preset.includeAssets}
                      onChange={(value) => update("includeAssets", value)}
                    />
                    <SwitchRow
                      label="灵感过程放入附录"
                      checked={preset.includeSourceIdeas}
                      onChange={(value) => update("includeSourceIdeas", value)}
                    />
                    {project.imagePromptVersions.length > 0 && (
                      <SwitchRow
                        label="包含生图提示词"
                        checked={preset.includeImagePrompt}
                        onChange={(value) => update("includeImagePrompt", value)}
                      />
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="files" className="mt-4 space-y-5">
                  <Field label="文件名（不含扩展名）">
                    <Input
                      value={fileName}
                      onChange={(event) => setFileName(event.target.value)}
                      placeholder={fileNames.docx?.replace(/\.docx$/i, "")}
                    />
                  </Field>
                  <div className="rounded-xl border border-white/[0.08] bg-black/15 p-3 text-[11px] leading-5 text-slate-500">
                    非法文件名字符、路径分隔符和控制字符会在服务端再次清理。默认格式：项目名称_项目计划_版本_YYYYMMDD。
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => saveExportPreset(preset)}>
                    <Save className="size-4" />
                    保存当前导出预设
                  </Button>
                  <div className="space-y-2">
                    {preset.formats.map((format) => (
                      <FormatStatus
                        key={format}
                        format={format}
                        state={status[format] || "idle"}
                        error={errors[format]}
                        result={downloads[format]}
                        onDownload={downloadBlob}
                        onRetry={() => void runExport([format])}
                      />
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </ScrollArea>
            <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] p-4">
              <div className="text-[10px] text-slate-600">
                {preset.formats.length} 个格式 · {preset.includedSections.length} 个章节
              </div>
              <div className="flex gap-2">
                {exporting && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      abortRef.current?.abort();
                      setExporting(false);
                    }}
                  >
                    <X className="size-4" />
                    取消
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={!preset.formats.length || exporting || !project.currentPlan}
                  onClick={() => void runExport()}
                  className="bg-[#a8ffcb] text-[#07120d] hover:bg-[#91efb7]"
                >
                  {exporting ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  {exporting ? "正在生成" : "生成并下载"}
                </Button>
              </div>
            </div>
          </section>

          <section className="hidden min-h-0 flex-col bg-[#070c14] lg:flex">
            <div className="flex h-[62px] items-center justify-between border-b border-white/[0.07] px-5">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Eye className="size-4 text-[#a8ffcb]" />
                实时预览
              </div>
              <div className="flex items-center gap-2">
                {previewing && <LoaderCircle className="size-3.5 animate-spin text-slate-500" />}
                <Badge variant="outline" className="border-white/10 font-mono text-[8px] text-slate-500">
                  A4 {preset.orientation === "portrait" ? "PORTRAIT" : "LANDSCAPE"}
                </Badge>
              </div>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="p-8">
                {previewError ? (
                  <div className="rounded-xl border border-red-400/20 bg-red-400/[0.05] p-5 text-sm text-red-200">
                    {previewError}
                  </div>
                ) : preview ? (
                  <DocumentPreview document={preview} />
                ) : (
                  <div className="flex h-96 items-center justify-center">
                    <LoaderCircle className="size-5 animate-spin text-[#a8ffcb]" />
                  </div>
                )}
              </div>
            </ScrollArea>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DocumentPreview({ document }: { document: ExportDocument }) {
  return (
    <div
      className={cn(
        "mx-auto min-h-[760px] bg-white text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,.45)]",
        document.options.orientation === "portrait" ? "max-w-[620px]" : "max-w-[760px]",
      )}
    >
      {document.cover && (
        <div className="flex min-h-[460px] flex-col justify-between border-b border-slate-200 p-12">
          <div>
            <p className="text-[10px] tracking-[.22em] text-emerald-700 uppercase">
              Idea Bubble Project Report
            </p>
            <h1 className="mt-14 text-4xl leading-tight font-semibold tracking-tight">
              {document.cover.title}
            </h1>
            <p className="mt-4 text-lg text-slate-500">{document.cover.subtitle}</p>
          </div>
          <div className="border-t border-slate-200 pt-5 text-xs leading-6 text-slate-500">
            <p>{document.cover.author}</p>
            <p>{document.cover.organization}</p>
            <p>
              {document.cover.versionName} · {document.cover.date}
            </p>
          </div>
        </div>
      )}
      <div className="space-y-9 p-12">
        {document.sections.map((section, index) => (
          <section key={section.id}>
            <div className="mb-4 flex items-baseline gap-3 border-b border-slate-200 pb-2">
              <span className="font-mono text-[9px] text-emerald-700">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h2 className="text-xl font-semibold">{section.title}</h2>
            </div>
            <div className="space-y-4">
              {section.blocks.map((block, blockIndex) => (
                <PreviewBlock key={blockIndex} block={block} />
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 px-12 py-4 text-[9px] text-slate-400">
        <span>{document.options.includeFooter ? document.metadata.projectName : ""}</span>
        <span>{document.options.includePageNumbers ? "01 / …" : ""}</span>
      </div>
    </div>
  );
}

function PreviewBlock({ block }: { block: ExportBlock }) {
  if (block.kind === "paragraph")
    return (
      <div>
        {block.label && <h3 className="mb-1 text-xs font-semibold text-slate-700">{block.label}</h3>}
        <p className="text-xs leading-6 whitespace-pre-wrap text-slate-600">{block.text}</p>
      </div>
    );
  if (block.kind === "list")
    return (
      <div>
        {block.label && <h3 className="mb-2 text-xs font-semibold">{block.label}</h3>}
        <ol className="space-y-1 text-xs leading-5 text-slate-600">
          {block.items.map((item, index) => (
            <li key={index}>
              {block.ordered ? `${index + 1}.` : "•"} {item}
            </li>
          ))}
        </ol>
      </div>
    );
  if (block.kind === "keyValue")
    return (
      <div className="grid grid-cols-2 border-t border-l border-slate-200 text-[10px]">
        {block.rows.map((row) => (
          <div key={row.label} className="contents">
            <div className="border-r border-b border-slate-200 bg-slate-50 p-2 font-medium">{row.label}</div>
            <div className="border-r border-b border-slate-200 p-2 text-slate-600">{row.value}</div>
          </div>
        ))}
      </div>
    );
  if (block.kind === "table")
    return (
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-[9px]">
          <thead>
            <tr>
              {block.columns.map((column) => (
                <th key={column} className="border border-slate-200 bg-slate-50 p-2 text-left">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="border border-slate-200 p-2 align-top text-slate-600">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  return (
    <div className="grid grid-cols-3 gap-2">
      {block.assets.map((asset) => (
        <div key={asset.name} className="rounded border border-slate-200 p-2 text-[9px] text-slate-500">
          {asset.dataUrl && asset.kind === "image" ? (
            <Image
              src={asset.dataUrl}
              alt={asset.name}
              width={240}
              height={160}
              unoptimized
              className="mb-1 aspect-square w-full object-cover"
            />
          ) : null}
          {asset.name}
        </div>
      ))}
    </div>
  );
}

function SettingSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h3 className="text-xs font-medium text-slate-200">{title}</h3>
        {description && <p className="mt-1 text-[10px] leading-4 text-slate-600">{description}</p>}
      </div>
      {children}
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-slate-400">{label}</Label>
      {children}
    </div>
  );
}
function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <Label className="text-xs font-normal text-slate-400">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function FormatStatus({
  format,
  state,
  error,
  result,
  onDownload,
  onRetry,
}: {
  format: ExportFormat;
  state: FormatState;
  error?: string;
  result?: DownloadResult;
  onDownload: (result: DownloadResult) => void;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.07] p-2.5">
      <div className="flex min-w-0 items-center gap-2">
        {state === "generating" ? (
          <LoaderCircle className="size-3.5 animate-spin text-[#a8ffcb]" />
        ) : state === "done" ? (
          <Check className="size-3.5 text-[#a8ffcb]" />
        ) : state === "error" ? (
          <X className="size-3.5 text-red-300" />
        ) : (
          <FileText className="size-3.5 text-slate-600" />
        )}
        <div>
          <p className="font-mono text-[10px] text-slate-400">{format.toUpperCase()}</p>
          {error && <p className="max-w-52 truncate text-[9px] text-red-300">{error}</p>}
        </div>
      </div>
      {state === "done" && result ? (
        <Button size="icon-sm" variant="ghost" title="再次下载" onClick={() => onDownload(result)}>
          <Download className="size-3.5" />
        </Button>
      ) : state === "error" ? (
        <Button size="icon-sm" variant="ghost" title="重新生成" onClick={onRetry}>
          <RefreshCcw className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
