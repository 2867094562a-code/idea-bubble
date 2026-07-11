import type { ExportDocument } from "./types";

/** Creates the human-readable report variant, excluding binary data and internal IDs. */
export function toReportObject(document: ExportDocument) {
  const metadata = {
    projectName: document.metadata.projectName,
    subtitle: document.metadata.subtitle,
    author: document.metadata.author,
    organization: document.metadata.organization,
    versionName: document.metadata.versionName,
    createdAt: document.metadata.createdAt,
    updatedAt: document.metadata.updatedAt,
    exportedAt: document.metadata.exportedAt,
  };
  return {
    metadata,
    cover: document.cover,
    sections: document.sections,
    assets: document.assets.map((asset) => ({
      name: asset.name,
      kind: asset.kind,
      mimeType: asset.mimeType,
      size: asset.size,
      description: asset.description,
    })),
    sourceIdeas: document.sourceIdeas,
    options: document.options,
  };
}

export function renderJsonText(document: ExportDocument): string {
  return `${JSON.stringify(toReportObject(document), null, 2)}\n`;
}

export function renderJson(document: ExportDocument): Uint8Array {
  return new TextEncoder().encode(renderJsonText(document));
}
