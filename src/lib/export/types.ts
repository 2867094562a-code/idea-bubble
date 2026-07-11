import type { AssetKind, ExportPreset, ExportSectionId } from "@/lib/domain";

export interface ExportMetadata {
  projectId: string;
  projectName: string;
  subtitle?: string;
  author?: string;
  organization?: string;
  versionName?: string;
  createdAt: string;
  updatedAt: string;
  exportedAt: string;
}

export interface ExportCover {
  title: string;
  subtitle?: string;
  author?: string;
  organization?: string;
  versionName?: string;
  date: string;
}

export interface ExportAsset {
  name: string;
  kind: AssetKind;
  mimeType: string;
  size: number;
  description?: string;
  dataUrl?: string;
}

export interface ExportIdea {
  word: string;
  category: string;
  reason: string;
  visualHint: string;
  relevance: number;
  collected: boolean;
  depth: number;
  sourceAssetName?: string;
}

export interface ExportParagraphBlock {
  kind: "paragraph";
  label?: string;
  text: string;
}

export interface ExportListBlock {
  kind: "list";
  label?: string;
  items: string[];
  ordered?: boolean;
}

export interface ExportKeyValueBlock {
  kind: "keyValue";
  label?: string;
  rows: Array<{ label: string; value: string }>;
}

export interface ExportTableBlock {
  kind: "table";
  label?: string;
  columns: string[];
  rows: string[][];
}

export interface ExportAssetGalleryBlock {
  kind: "assetGallery";
  label?: string;
  assets: ExportAsset[];
}

export type ExportBlock =
  ExportParagraphBlock | ExportListBlock | ExportKeyValueBlock | ExportTableBlock | ExportAssetGalleryBlock;

export interface ExportSection {
  id: Exclude<ExportSectionId, "cover">;
  title: string;
  blocks: ExportBlock[];
}

export interface ExportDocumentOptions {
  layout: ExportPreset["layout"];
  orientation: ExportPreset["orientation"];
  includeTableOfContents: boolean;
  includeHeader: boolean;
  includeFooter: boolean;
  includePageNumbers: boolean;
  customRequirements?: string;
}

/**
 * The single normalized document consumed by every renderer. It intentionally
 * contains presentation-ready text instead of exposing store implementation
 * details such as node IDs, AI logs, or provider settings.
 */
export interface ExportDocument {
  metadata: ExportMetadata;
  cover?: ExportCover;
  sections: ExportSection[];
  assets: ExportAsset[];
  sourceIdeas?: ExportIdea[];
  options: ExportDocumentOptions;
}

export type ExportRendererFormat = "docx" | "pdf" | "txt" | "markdown" | "json";

export interface RenderedExport {
  bytes: Uint8Array;
  mimeType: string;
  extension: ExportRendererFormat;
}
