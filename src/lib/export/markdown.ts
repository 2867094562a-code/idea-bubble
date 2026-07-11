import type { ExportBlock, ExportDocument } from "./types";

function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_{}[\]()#+.!|>-])/g, "\\$1");
}

function tableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>").trim();
}

function anchorFor(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[\s/]+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "");
}

function blockToMarkdown(block: ExportBlock): string[] {
  const lines: string[] = [];
  if (block.label) lines.push(`### ${escapeMarkdown(block.label)}`, "");

  switch (block.kind) {
    case "paragraph":
      lines.push(block.text);
      break;
    case "list":
      block.items.forEach((item, index) => {
        lines.push(`${block.ordered ? `${index + 1}.` : "-"} ${item}`);
      });
      break;
    case "keyValue":
      lines.push("| 项目 | 内容 |", "| --- | --- |");
      block.rows.forEach((row) => lines.push(`| ${tableCell(row.label)} | ${tableCell(row.value)} |`));
      break;
    case "table":
      lines.push(
        `| ${block.columns.map(tableCell).join(" | ")} |`,
        `| ${block.columns.map(() => "---").join(" | ")} |`,
      );
      block.rows.forEach((row) => {
        const cells = block.columns.map((_, index) => tableCell(row[index] ?? ""));
        lines.push(`| ${cells.join(" | ")} |`);
      });
      break;
    case "assetGallery":
      block.assets.forEach((asset) => {
        lines.push(`- **${escapeMarkdown(asset.name)}** — ${escapeMarkdown(asset.mimeType)}`);
        if (asset.description) lines.push(`  - ${asset.description}`);
      });
      break;
  }

  return lines;
}

export function renderMarkdownText(document: ExportDocument): string {
  const lines: string[] = [];
  const title = document.cover?.title || document.metadata.projectName;
  lines.push(`# ${escapeMarkdown(title)}`);

  if (document.cover?.subtitle) lines.push("", `> ${document.cover.subtitle}`);
  const coverFacts = [
    document.cover?.author ? `作者：${document.cover.author}` : "",
    document.cover?.organization ? `单位：${document.cover.organization}` : "",
    document.cover?.versionName ? `版本：${document.cover.versionName}` : "",
    document.cover?.date ? `日期：${document.cover.date}` : "",
  ].filter(Boolean);
  if (coverFacts.length) lines.push("", ...coverFacts.map((fact) => `- ${fact}`));

  if (document.options.includeTableOfContents && document.sections.length) {
    lines.push("", "## 目录", "");
    document.sections.forEach((section) => {
      lines.push(`- [${escapeMarkdown(section.title)}](#${anchorFor(section.title)})`);
    });
  }

  document.sections.forEach((section) => {
    lines.push("", `## ${escapeMarkdown(section.title)}`, "");
    section.blocks.forEach((block) => {
      lines.push(...blockToMarkdown(block), "");
    });
  });

  return `${lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}

export function renderMarkdown(document: ExportDocument): Uint8Array {
  return new TextEncoder().encode(renderMarkdownText(document));
}
