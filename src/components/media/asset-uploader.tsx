"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  FileImage,
  ImageIcon,
  LoaderCircle,
  Sparkles,
  Trash2,
  Upload,
  Video,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Asset, AssetKind, AssetStatus } from "@/lib/domain";
import {
  GIF_ACCEPT,
  IMAGE_ACCEPT,
  VIDEO_ACCEPT,
  analyzeImageAsset,
  formatFileSize,
  readFileAsDataUrl,
  unsupportedFrameExtractor,
  unsupportedMediaAnalyzer,
  validateMediaFile,
} from "@/lib/media";
import { cn } from "@/lib/utils";
import { useIdeaStore } from "@/store/idea-store";

const EMPTY_ASSETS: Asset[] = [];

const STATUS_LABELS: Record<AssetStatus, string> = {
  ready: "已上传",
  analyzing: "分析中",
  analyzed: "已生成气泡",
  unsupported: "仅保存与预览",
  error: "处理失败",
};

const STATUS_VARIANTS: Record<AssetStatus, "default" | "secondary" | "destructive" | "outline"> = {
  ready: "outline",
  analyzing: "secondary",
  analyzed: "default",
  unsupported: "secondary",
  error: "destructive",
};

interface UploadProgressState {
  fileName: string;
  progress: number;
}

export interface AssetUploaderProps {
  className?: string;
}

function mediaKindLabel(kind: AssetKind) {
  if (kind === "image") return "图片";
  if (kind === "video") return "视频";
  return "GIF";
}

function UnsupportedNotice({ kind }: { kind: "video" | "gif" }) {
  return (
    <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] leading-4 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
      <span>
        {kind === "video"
          ? "已完成本地保存与预览；当前版本未实现抽帧或视频语义理解。"
          : "已完成本地保存与预览；当前版本尚未拆帧，不会伪造 GIF 语义分析。"}
      </span>
    </p>
  );
}

function AssetPreview({ asset }: { asset: Asset }) {
  if (asset.kind === "video") {
    return (
      <video
        className="aspect-video max-h-36 w-full rounded-lg bg-black object-contain"
        src={asset.dataUrl}
        controls
        preload="metadata"
        aria-label={`${asset.name} 视频预览`}
      />
    );
  }

  return (
    <Image
      className="bg-muted aspect-video max-h-36 w-full rounded-lg object-contain"
      src={asset.dataUrl}
      alt={`${asset.name}${asset.kind === "gif" ? " GIF" : "图片"}预览`}
      width={640}
      height={360}
      unoptimized
      loading="lazy"
    />
  );
}

export function AssetUploader({ className }: AssetUploaderProps) {
  const project = useIdeaStore((state) => state.project);
  const assets = useIdeaStore((state) => state.project?.assets ?? EMPTY_ASSETS);
  const provider = useIdeaStore((state) => state.provider);
  const busyTask = useIdeaStore((state) => state.busyTask);
  const addAsset = useIdeaStore((state) => state.addAsset);
  const updateAsset = useIdeaStore((state) => state.updateAsset);
  const removeAsset = useIdeaStore((state) => state.removeAsset);
  const addExpansion = useIdeaStore((state) => state.addExpansion);
  const setBusyTask = useIdeaStore((state) => state.setBusyTask);
  const setStoreError = useIdeaStore((state) => state.setError);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const gifInputRef = useRef<HTMLInputElement>(null);
  const uploadControllerRef = useRef<AbortController | undefined>(undefined);
  const analysisControllerRef = useRef<AbortController | undefined>(undefined);
  const analysisAssetIdRef = useRef<string | undefined>(undefined);
  const [upload, setUpload] = useState<UploadProgressState>();
  const [analyzingAssetId, setAnalyzingAssetId] = useState<string>();
  const [message, setMessage] = useState<string>();

  useEffect(
    () => () => {
      uploadControllerRef.current?.abort();
      analysisControllerRef.current?.abort();
      const activeAssetId = analysisAssetIdRef.current;
      if (activeAssetId) updateAsset(activeAssetId, { status: "ready" });
      if (useIdeaStore.getState().busyTask === "vision") setBusyTask(undefined);
    },
    [setBusyTask, updateAsset],
  );

  const reportError = (error: unknown) => {
    if (error instanceof DOMException && error.name === "AbortError") return;
    const text = error instanceof Error ? error.message : "素材处理失败，请重试。";
    setMessage(text);
    setStoreError(text);
  };

  const processFile = async (file: File, expectedKind: AssetKind) => {
    if (!project) {
      reportError(new Error("请先创建项目，再上传素材。"));
      return;
    }

    setMessage(undefined);
    setStoreError(undefined);
    const validation = validateMediaFile(file, expectedKind);
    if (!validation.ok) {
      reportError(new Error(validation.message));
      return;
    }

    uploadControllerRef.current?.abort();
    const controller = new AbortController();
    uploadControllerRef.current = controller;
    setUpload({ fileName: file.name, progress: 0 });

    try {
      const dataUrl = await readFileAsDataUrl(file, {
        signal: controller.signal,
        onProgress: (progress) => setUpload({ fileName: file.name, progress }),
      });

      const asset: Asset = {
        id: crypto.randomUUID(),
        kind: validation.kind,
        name: file.name,
        mimeType: file.type.toLocaleLowerCase(),
        size: file.size,
        dataUrl,
        status: validation.kind === "image" ? "ready" : "unsupported",
        createdAt: new Date().toISOString(),
      };

      if (asset.kind === "gif") {
        await unsupportedFrameExtractor.extractFrames(asset, {
          signal: controller.signal,
        });
      } else if (asset.kind === "video") {
        await unsupportedMediaAnalyzer.analyze(asset, {
          signal: controller.signal,
        });
      }

      addAsset(asset);
    } catch (error) {
      reportError(error);
    } finally {
      if (uploadControllerRef.current === controller) {
        uploadControllerRef.current = undefined;
        setUpload(undefined);
      }
    }
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>, kind: AssetKind) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void processFile(file, kind);
  };

  const analyzeAsset = async (asset: Asset) => {
    if (asset.kind !== "image" || analyzingAssetId || busyTask) return;

    analysisControllerRef.current?.abort();
    const controller = new AbortController();
    analysisControllerRef.current = controller;
    analysisAssetIdRef.current = asset.id;
    setMessage(undefined);
    setStoreError(undefined);
    setAnalyzingAssetId(asset.id);
    setBusyTask("vision");
    updateAsset(asset.id, { status: "analyzing" });

    try {
      const result = await analyzeImageAsset(asset, provider, controller.signal);
      addExpansion(result.expansion.source, undefined, asset.id, result.expansion.ideas);
      updateAsset(asset.id, {
        status: "analyzed",
        analysis: result.analysis || `已从“${asset.name}”生成 10 个灵感气泡。`,
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        updateAsset(asset.id, { status: "error" });
      }
      reportError(error);
    } finally {
      if (analysisControllerRef.current === controller) {
        analysisControllerRef.current = undefined;
        analysisAssetIdRef.current = undefined;
        setAnalyzingAssetId(undefined);
        if (useIdeaStore.getState().busyTask === "vision") {
          setBusyTask(undefined);
        }
      }
    }
  };

  const deleteAsset = (asset: Asset) => {
    if (analyzingAssetId === asset.id) {
      analysisControllerRef.current?.abort();
      analysisControllerRef.current = undefined;
      analysisAssetIdRef.current = undefined;
      setAnalyzingAssetId(undefined);
      if (useIdeaStore.getState().busyTask === "vision") {
        setBusyTask(undefined);
      }
    }
    removeAsset(asset.id);
  };

  const uploadDisabled = !project || Boolean(upload);

  return (
    <section
      className={cn("min-w-0 space-y-3", className)}
      aria-labelledby="asset-uploader-title"
      data-testid="asset-uploader"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 id="asset-uploader-title" className="text-sm font-semibold">
            素材
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">上传内容会随项目保存在本机</p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {assets.length} 项
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="选择素材类型">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-w-0"
          disabled={uploadDisabled}
          onClick={() => imageInputRef.current?.click()}
        >
          <ImageIcon aria-hidden="true" />
          <span className="truncate">图片</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-w-0"
          disabled={uploadDisabled}
          onClick={() => videoInputRef.current?.click()}
        >
          <Video aria-hidden="true" />
          <span className="truncate">视频</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-w-0"
          disabled={uploadDisabled}
          onClick={() => gifInputRef.current?.click()}
        >
          <FileImage aria-hidden="true" />
          <span className="truncate">GIF</span>
        </Button>
      </div>

      <input
        ref={imageInputRef}
        className="sr-only"
        type="file"
        accept={IMAGE_ACCEPT}
        onChange={(event) => handleInput(event, "image")}
        data-testid="media-input-image"
        aria-label="上传图片，最大 3 MB"
      />
      <input
        ref={videoInputRef}
        className="sr-only"
        type="file"
        accept={VIDEO_ACCEPT}
        onChange={(event) => handleInput(event, "video")}
        data-testid="media-input-video"
        aria-label="上传视频，最大 25 MB"
      />
      <input
        ref={gifInputRef}
        className="sr-only"
        type="file"
        accept={GIF_ACCEPT}
        onChange={(event) => handleInput(event, "gif")}
        data-testid="media-input-gif"
        aria-label="上传 GIF，最大 8 MB"
      />

      {upload ? (
        <div className="bg-muted/30 space-y-1.5 rounded-lg border p-2.5" aria-live="polite">
          <div className="flex min-w-0 items-center gap-2 text-xs">
            <Upload className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">正在保存 {upload.fileName}</span>
            <span className="text-muted-foreground tabular-nums">{upload.progress}%</span>
          </div>
          <Progress value={upload.progress} aria-label="素材保存进度" />
        </div>
      ) : null}

      {message ? (
        <p
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-2.5 py-2 text-xs leading-5"
          role="alert"
        >
          {message}
        </p>
      ) : null}

      {!project ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-center text-xs">
          创建项目后即可上传图片、视频或 GIF。
        </p>
      ) : assets.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-center text-xs">
          图片不超过 3 MB，GIF 不超过 8 MB，视频不超过 25 MB。
        </p>
      ) : (
        <ul className="space-y-2" aria-label="已上传素材">
          {assets.map((asset) => {
            const analyzing = analyzingAssetId === asset.id;
            return (
              <li key={asset.id}>
                <Card size="sm" className="min-w-0 gap-2 py-2.5">
                  <CardHeader className="min-w-0 gap-1 px-2.5">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-xs" title={asset.name}>
                          {asset.name}
                        </CardTitle>
                        <p className="text-muted-foreground mt-0.5 text-[11px]">
                          {mediaKindLabel(asset.kind)} · {formatFileSize(asset.size)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => deleteAsset(asset)}
                        aria-label={`删除素材 ${asset.name}`}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                    <Badge variant={STATUS_VARIANTS[asset.status]}>
                      {analyzing ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
                      {STATUS_LABELS[asset.status]}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-2 px-2.5">
                    <AssetPreview asset={asset} />

                    {asset.kind === "video" || asset.kind === "gif" ? (
                      <UnsupportedNotice kind={asset.kind} />
                    ) : null}

                    {asset.analysis ? (
                      <p className="text-muted-foreground text-[11px] leading-4">{asset.analysis}</p>
                    ) : null}

                    {asset.kind === "image" && asset.status !== "analyzed" ? (
                      <Button
                        type="button"
                        size="sm"
                        className="w-full"
                        disabled={analyzing || Boolean(busyTask)}
                        onClick={() => void analyzeAsset(asset)}
                        data-testid={`analyze-image-${asset.id}`}
                      >
                        {analyzing ? (
                          <LoaderCircle className="animate-spin" aria-hidden="true" />
                        ) : (
                          <Sparkles aria-hidden="true" />
                        )}
                        {analyzing
                          ? "正在分析图片"
                          : asset.status === "error"
                            ? "重试图片分析"
                            : "分析并生成气泡"}
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
