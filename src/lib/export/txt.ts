import type { ExportBlock, ExportDocument } from "./types";

function blockToText(block: ExportBlock): string[] {
  const lines: string[] = [];
  if (block.label) lines.push(block.label);

  switch (block.kind) {
    case "paragraph":
      lines.push(block.text);
      break;
    case "list":
      block.items.forEach((item, index) => {
        lines.push(block.ordered ? `${index + 1}. ${item}` : `• ${item}`);
      });
      break;
    case "keyValue":
      block.rows.forEach((row) => lines.push(`${row.label}：${row.value}`));
      break;
    case "table":
      lines.push(block.columns.join(" | "));
      lines.push(block.columns.map(() => "-").join(" | "));
      block.rows.forEach((row) => {
        lines.push(row.map((cell) => cell.replace(/\r?\n/g, "；")).join(" | "));
      });
      break;
    case "assetGallery":
      block.assets.forEach((asset, index) => {
        lines.push(`${index + 1}. ${asset.name}（${asset.mimeType}）`);
        if (asset.description) lines.push(`   说明：${asset.description}`);
      });
      break;
  }
  return lines;
}

export function renderTxtText(document: ExportDocument): string {
  const lines: string[] = [];
  const title = document.cover?.title || document.metadata.projectName;
  lines.push(title, "=".repeat(Math.max(8, Math.min(32, title.length * 2))));

  if (document.cover?.subtitle) lines.push(document.cover.subtitle);
  if (document.cover?.author) lines.push(`作者：${document.cover.author}`);
  if (document.cover?.organization) lines.push(`单位：${document.cover.organization}`);
  if (document.cover?.versionName) lines.push(`版本：${document.cover.versionName}`);
  if (document.cover?.date) lines.push(`日期：${document.cover.date}`);

  document.sections.forEach((section, sectionIndex) => {
    lines.push(
      "",
      `${sectionIndex + 1}. ${section.title}`,
      "-".repeat(Math.max(6, section.title.length * 2)),
    );
    section.blocks.forEach((block) => {
      const blockLines = blockToText(block);
      if (blockLines.length) lines.push("", ...blockLines);
    });
  });

  return lines
    .join("\r\n")
    .replace(/(?:\r\n){3,}/g, "\r\n\r\n")
    .trimEnd();
}

export function renderTxt(document: ExportDocument): Uint8Array {
  return new TextEncoder().encode(`\uFEFF${renderTxtText(document)}`);
}
