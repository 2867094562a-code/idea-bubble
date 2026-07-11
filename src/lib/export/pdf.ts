import { readFile } from "node:fs/promises";
import path from "node:path";

import PDFDocument from "pdfkit";

import { decodeDataUrlImage, fitImage } from "./image";
import type { ExportBlock, ExportDocument, ExportTableBlock } from "./types";

const FONT_NAME = "NotoSansSC";
const PAGE_MARGIN = 54;
const CONTENT_TOP = 66;
const CONTENT_BOTTOM_MARGIN = 62;
let fontPromise: Promise<Buffer> | undefined;

function loadChineseFont(): Promise<Buffer> {
  fontPromise ??= readFile(path.join(process.cwd(), "public", "fonts", "NotoSansCJKsc-Regular.otf"));
  return fontPromise;
}

function palette(layout: ExportDocument["options"]["layout"]) {
  switch (layout) {
    case "business":
      return { accent: "#1e40af", pale: "#dbeafe", text: "#172033", muted: "#64748b", line: "#cbd5e1" };
    case "creative":
      return { accent: "#7c3aed", pale: "#ede9fe", text: "#2e1065", muted: "#6b7280", line: "#d8b4fe" };
    case "school":
      return { accent: "#0f766e", pale: "#ccfbf1", text: "#134e4a", muted: "#64748b", line: "#99f6e4" };
    case "plain":
      return { accent: "#111827", pale: "#f3f4f6", text: "#111827", muted: "#6b7280", line: "#d1d5db" };
    default:
      return { accent: "#334155", pale: "#f1f5f9", text: "#1e293b", muted: "#64748b", line: "#cbd5e1" };
  }
}

interface PdfState {
  doc: PDFKit.PDFDocument;
  document: ExportDocument;
  colors: ReturnType<typeof palette>;
  pageCount: number;
  coverPageIndex?: number;
  tocPageIndex?: number;
  tocEntries: Array<{ title: string; page: number }>;
}

function pageWidth(state: PdfState): number {
  return state.doc.page.width - PAGE_MARGIN * 2;
}

function pageBottom(state: PdfState): number {
  return state.doc.page.height - CONTENT_BOTTOM_MARGIN;
}

function addPage(state: PdfState): void {
  state.doc.addPage();
  state.pageCount += 1;
  state.doc.font(FONT_NAME).fontSize(10).fillColor(state.colors.text);
  state.doc.x = PAGE_MARGIN;
  state.doc.y = CONTENT_TOP;
}

function ensureSpace(state: PdfState, height: number): void {
  if (state.doc.y + height > pageBottom(state)) addPage(state);
}

function fittingChunk(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  maxHeight: number,
  options: PDFKit.Mixins.TextOptions,
): { chunk: string; rest: string } {
  if (!text) return { chunk: "", rest: "" };
  if (doc.heightOfString(text, { ...options, width }) <= maxHeight) return { chunk: text, rest: "" };

  const chars = Array.from(text);
  let low = 1;
  let high = chars.length;
  let best = 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = chars.slice(0, middle).join("");
    if (doc.heightOfString(candidate, { ...options, width }) <= maxHeight) {
      best = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  let splitAt = best;
  const preferred = chars
    .slice(0, best)
    .join("")
    .search(/[\n，。；、,.!?！？;][^\n，。；、,.!?！？;]*$/u);
  if (preferred > Math.floor(best * 0.55))
    splitAt = Array.from(
      chars
        .slice(0, best)
        .join("")
        .slice(0, preferred + 1),
    ).length;
  return {
    chunk: chars.slice(0, splitAt).join("").trimEnd(),
    rest: chars.slice(splitAt).join("").trimStart(),
  };
}

function drawFlowText(
  state: PdfState,
  text: string,
  options: {
    size?: number;
    color?: string;
    indent?: number;
    align?: "left" | "center" | "right";
    gapAfter?: number;
  } = {},
): void {
  const doc = state.doc;
  const size = options.size ?? 10.5;
  const indent = options.indent ?? 0;
  const width = pageWidth(state) - indent;
  const textOptions: PDFKit.Mixins.TextOptions = {
    width,
    lineGap: 3,
    align: options.align ?? "left",
  };
  doc
    .font(FONT_NAME)
    .fontSize(size)
    .fillColor(options.color ?? state.colors.text);
  let remaining = text;
  while (remaining) {
    if (pageBottom(state) - doc.y < size * 2.2) addPage(state);
    const maxHeight = pageBottom(state) - doc.y;
    const { chunk, rest } = fittingChunk(doc, remaining, width, maxHeight, textOptions);
    doc.text(chunk || remaining[0], PAGE_MARGIN + indent, doc.y, textOptions);
    remaining = chunk ? rest : remaining.slice(1);
    if (remaining) addPage(state);
  }
  doc.y += options.gapAfter ?? 7;
}

function drawLabel(state: PdfState, label: string): void {
  ensureSpace(state, 34);
  state.doc.font(FONT_NAME).fontSize(13).fillColor(state.colors.accent);
  state.doc.text(label, PAGE_MARGIN, state.doc.y, { width: pageWidth(state), lineGap: 2 });
  state.doc.y += 8;
}

function drawSectionHeading(state: PdfState, title: string): void {
  ensureSpace(state, 54);
  state.doc.font(FONT_NAME).fontSize(19).fillColor(state.colors.accent);
  state.doc.text(title, PAGE_MARGIN, state.doc.y, { width: pageWidth(state), lineGap: 2 });
  state.doc.y += 4;
  state.doc.strokeColor(state.colors.line).lineWidth(0.8);
  state.doc
    .moveTo(PAGE_MARGIN, state.doc.y)
    .lineTo(state.doc.page.width - PAGE_MARGIN, state.doc.y)
    .stroke();
  state.doc.y += 15;
}

function tableWidths(columnCount: number, availableWidth: number): number[] {
  const ratios =
    columnCount === 2
      ? [0.25, 0.75]
      : columnCount === 5
        ? [0.16, 0.14, 0.25, 0.33, 0.12]
        : columnCount === 4
          ? [0.23, 0.16, 0.36, 0.25]
          : Array.from({ length: Math.max(1, columnCount) }, () => 1 / Math.max(1, columnCount));
  const widths = ratios.map((ratio) => availableWidth * ratio);
  widths[widths.length - 1] += availableWidth - widths.reduce((sum, width) => sum + width, 0);
  return widths;
}

function drawRowSegment(
  state: PdfState,
  cells: string[],
  widths: number[],
  options: { header?: boolean; alternate?: boolean },
): { rest: string[]; complete: boolean } {
  const doc = state.doc;
  const padding = 5;
  const fontSize = options.header ? 8.8 : widths.length >= 5 ? 7.4 : 8.5;
  const minRowHeight = options.header ? 27 : 25;
  doc.font(FONT_NAME).fontSize(fontSize);

  if (pageBottom(state) - doc.y < minRowHeight) addPage(state);
  const maxInnerHeight = Math.max(fontSize * 1.6, pageBottom(state) - doc.y - padding * 2);
  const chunks = cells.map((cell, index) =>
    fittingChunk(doc, cell, Math.max(8, widths[index] - padding * 2), maxInnerHeight, {
      width: Math.max(8, widths[index] - padding * 2),
      lineGap: 1.5,
    }),
  );
  const heights = chunks.map(({ chunk }, index) =>
    chunk
      ? doc.heightOfString(chunk, { width: Math.max(8, widths[index] - padding * 2), lineGap: 1.5 })
      : fontSize * 1.35,
  );
  const rowHeight = Math.max(minRowHeight, ...heights.map((height) => height + padding * 2));
  const y = doc.y;
  let x = PAGE_MARGIN;

  widths.forEach((width, index) => {
    doc.save();
    doc.fillColor(options.header ? state.colors.pale : options.alternate ? "#f8fafc" : "#ffffff");
    doc.rect(x, y, width, rowHeight).fill();
    doc.strokeColor(state.colors.line).lineWidth(0.55).rect(x, y, width, rowHeight).stroke();
    doc
      .fillColor(options.header ? state.colors.accent : state.colors.text)
      .font(FONT_NAME)
      .fontSize(fontSize);
    if (chunks[index].chunk) {
      doc.text(chunks[index].chunk, x + padding, y + padding, {
        width: Math.max(8, width - padding * 2),
        height: Math.max(fontSize, rowHeight - padding * 2),
        lineGap: 1.5,
      });
    }
    doc.restore();
    x += width;
  });
  doc.x = PAGE_MARGIN;
  doc.y = y + rowHeight;
  const rest = chunks.map((chunk) => chunk.rest);
  return { rest, complete: rest.every((value) => !value) };
}

function drawTable(state: PdfState, block: ExportTableBlock): void {
  const columns = block.columns.length ? block.columns : ["内容"];
  const widths = tableWidths(columns.length, pageWidth(state));
  const drawHeader = () => {
    drawRowSegment(state, columns, widths, { header: true });
  };

  ensureSpace(state, 58);
  drawHeader();
  block.rows.forEach((row, rowIndex) => {
    let remaining = columns.map((_, index) => row[index] ?? "");
    let complete = false;
    while (!complete) {
      if (pageBottom(state) - state.doc.y < 28) {
        addPage(state);
        drawHeader();
      }
      const result = drawRowSegment(state, remaining, widths, { alternate: rowIndex % 2 === 1 });
      remaining = result.rest;
      complete = result.complete;
      if (!complete) {
        addPage(state);
        drawHeader();
      }
    }
  });
  state.doc.y += 11;
}

function drawAssetGallery(state: PdfState, block: Extract<ExportBlock, { kind: "assetGallery" }>): void {
  for (const asset of block.assets) {
    const image = decodeDataUrlImage(asset.dataUrl);
    const supported = image && image.type !== "gif";
    if (supported) {
      const maxHeight = Math.min(330, state.doc.page.height - CONTENT_TOP - CONTENT_BOTTOM_MARGIN - 55);
      const fitted = fitImage(image.width, image.height, pageWidth(state), maxHeight);
      ensureSpace(state, fitted.height + 45);
      const x = PAGE_MARGIN + (pageWidth(state) - fitted.width) / 2;
      state.doc.image(image.data, x, state.doc.y, { width: fitted.width, height: fitted.height });
      state.doc.y += fitted.height + 7;
      drawFlowText(state, `图：${asset.name}`, {
        size: 8.5,
        color: state.colors.muted,
        align: "center",
        gapAfter: 3,
      });
    } else {
      drawFlowText(state, `素材引用：${asset.name}（${asset.mimeType}）`, {
        size: 9,
        color: state.colors.muted,
        gapAfter: 3,
      });
    }
    if (asset.description) {
      drawFlowText(state, asset.description, {
        size: 8.5,
        color: state.colors.muted,
        align: "center",
        gapAfter: 9,
      });
    }
  }
}

function drawBlock(state: PdfState, block: ExportBlock): void {
  if (block.label) drawLabel(state, block.label);
  switch (block.kind) {
    case "paragraph":
      drawFlowText(state, block.text);
      break;
    case "list":
      block.items.forEach((item, index) => {
        drawFlowText(state, `${block.ordered ? `${index + 1}.` : "•"} ${item}`, { indent: 8, gapAfter: 3 });
      });
      state.doc.y += 5;
      break;
    case "keyValue":
      drawTable(state, {
        kind: "table",
        columns: ["项目", "内容"],
        rows: block.rows.map((row) => [row.label, row.value]),
      });
      break;
    case "table":
      drawTable(state, block);
      break;
    case "assetGallery":
      drawAssetGallery(state, block);
      break;
  }
}

function drawCover(state: PdfState): void {
  const cover = state.document.cover;
  if (!cover) return;
  state.doc.fillColor(state.colors.accent).font(FONT_NAME).fontSize(30);
  state.doc.text(cover.title, PAGE_MARGIN, 175, { width: pageWidth(state), align: "center", lineGap: 5 });
  if (cover.subtitle) {
    state.doc.fillColor(state.colors.text).fontSize(16);
    state.doc.text(cover.subtitle, PAGE_MARGIN, state.doc.y + 20, {
      width: pageWidth(state),
      align: "center",
      lineGap: 3,
    });
  }
  const facts = [
    cover.author ? `作者：${cover.author}` : "",
    cover.organization ? `单位：${cover.organization}` : "",
    cover.versionName ? `版本：${cover.versionName}` : "",
    `日期：${cover.date}`,
  ].filter(Boolean);
  state.doc.fillColor(state.colors.muted).fontSize(10.5);
  let y = Math.max(state.doc.y + 80, state.doc.page.height - 210);
  facts.forEach((fact) => {
    state.doc.text(fact, PAGE_MARGIN, y, { width: pageWidth(state), align: "center" });
    y += 23;
  });
}

function drawContents(state: PdfState): void {
  if (state.tocPageIndex === undefined) return;
  state.doc.switchToPage(state.tocPageIndex);
  state.doc.font(FONT_NAME).fillColor(state.colors.accent).fontSize(22);
  state.doc.text("目录", PAGE_MARGIN, CONTENT_TOP, { width: pageWidth(state) });
  let y = state.doc.y + 22;
  state.tocEntries.forEach((entry, index) => {
    state.doc.font(FONT_NAME).fillColor(state.colors.text).fontSize(11);
    const prefix = `${index + 1}. ${entry.title}`;
    const pageText = String(entry.page);
    const pageTextWidth = state.doc.widthOfString(pageText);
    const titleWidth = pageWidth(state) - pageTextWidth - 22;
    state.doc.text(prefix, PAGE_MARGIN, y, { width: titleWidth, lineBreak: false });
    state.doc.text(pageText, PAGE_MARGIN + pageWidth(state) - pageTextWidth, y, {
      width: pageTextWidth,
      align: "right",
    });
    const lineStart = PAGE_MARGIN + Math.min(titleWidth - 6, state.doc.widthOfString(prefix) + 8);
    if (lineStart < PAGE_MARGIN + pageWidth(state) - pageTextWidth - 8) {
      state.doc.save().strokeColor(state.colors.line).lineWidth(0.5).dash(1.5, { space: 2.5 });
      state.doc
        .moveTo(lineStart, y + 11)
        .lineTo(PAGE_MARGIN + pageWidth(state) - pageTextWidth - 8, y + 11)
        .stroke()
        .restore();
    }
    y += 28;
  });
}

function drawHeadersAndFooters(state: PdfState): void {
  if (
    !state.document.options.includeHeader &&
    !state.document.options.includeFooter &&
    !state.document.options.includePageNumbers
  )
    return;
  const range = state.doc.bufferedPageRange();
  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
    if (pageIndex === state.coverPageIndex) continue;
    state.doc.switchToPage(pageIndex);
    const width = state.doc.page.width - PAGE_MARGIN * 2;
    state.doc.font(FONT_NAME).fontSize(8).fillColor(state.colors.muted);
    if (state.document.options.includeHeader) {
      state.doc.text(state.document.metadata.projectName, PAGE_MARGIN, 25, {
        width,
        align: "right",
        lineBreak: false,
      });
      state.doc
        .strokeColor(state.colors.line)
        .lineWidth(0.5)
        .moveTo(PAGE_MARGIN, 43)
        .lineTo(state.doc.page.width - PAGE_MARGIN, 43)
        .stroke();
    }
    const footerParts = [
      state.document.options.includeFooter ? "Idea Bubble 项目文档" : "",
      state.document.options.includePageNumbers ? `第 ${pageIndex + 1} 页 / 共 ${range.count} 页` : "",
    ].filter(Boolean);
    if (footerParts.length) {
      state.doc.text(footerParts.join("  ·  "), PAGE_MARGIN, state.doc.page.height - 35, {
        width,
        align: "center",
        lineBreak: false,
      });
    }
  }
}

function collectPdf(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export async function renderPdf(document: ExportDocument): Promise<Uint8Array> {
  const font = await loadChineseFont();
  const creationDate = new Date(document.metadata.exportedAt);
  const doc = new PDFDocument({
    autoFirstPage: false,
    bufferPages: true,
    size: "A4",
    layout: document.options.orientation,
    margins: { top: PAGE_MARGIN, right: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN },
    compress: true,
    info: {
      Title: document.metadata.projectName,
      Author: document.metadata.author || "Idea Bubble",
      Creator: "Idea Bubble",
      Producer: "PDFKit",
      Subject: "Idea Bubble 项目导出",
      CreationDate: Number.isNaN(creationDate.getTime()) ? new Date(0) : creationDate,
    },
  });
  doc.registerFont(FONT_NAME, font);
  const state: PdfState = {
    doc,
    document,
    colors: palette(document.options.layout),
    pageCount: 0,
    tocEntries: [],
  };

  if (document.cover) {
    addPage(state);
    state.coverPageIndex = state.pageCount - 1;
    drawCover(state);
  }
  if (document.options.includeTableOfContents && document.sections.length) {
    addPage(state);
    state.tocPageIndex = state.pageCount - 1;
  }

  if (document.sections.length) {
    if (!state.pageCount || state.tocPageIndex !== undefined || state.coverPageIndex !== undefined)
      addPage(state);
    document.sections.forEach((section, index) => {
      ensureSpace(state, 58);
      state.tocEntries.push({ title: section.title, page: state.pageCount });
      drawSectionHeading(state, `${index + 1}. ${section.title}`);
      section.blocks.forEach((block) => drawBlock(state, block));
      state.doc.y += 9;
    });
  } else if (!state.pageCount) {
    addPage(state);
    drawSectionHeading(state, document.metadata.projectName);
    drawFlowText(state, "当前导出范围没有可用内容。", { color: state.colors.muted });
  }

  drawContents(state);
  drawHeadersAndFooters(state);
  return new Uint8Array(await collectPdf(doc));
}
