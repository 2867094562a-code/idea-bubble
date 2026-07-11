import { readFile } from "node:fs/promises";
import path from "node:path";
import subsetFont from "subset-font";

import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  PageNumber,
  PageOrientation,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type IFontAttributesProperties,
} from "docx";

import { decodeDataUrlImage, fitImage } from "./image";
import type { ExportBlock, ExportDocument } from "./types";

const A4_WIDTH = 11_906;
const A4_HEIGHT = 16_838;
const PAGE_MARGIN = 900;
const BODY_FONT_NAME = "Noto Sans CJK SC";
let fontPromise: Promise<Buffer> | undefined;
const BODY_FONT: IFontAttributesProperties = {
  ascii: BODY_FONT_NAME,
  hAnsi: BODY_FONT_NAME,
  eastAsia: BODY_FONT_NAME,
  cs: BODY_FONT_NAME,
};

function loadDocumentFont(): Promise<Buffer> {
  fontPromise ??= readFile(path.join(process.cwd(), "public", "fonts", "NotoSansCJKsc-Regular.otf"));
  return fontPromise;
}

function palette(layout: ExportDocument["options"]["layout"]) {
  switch (layout) {
    case "business":
      return { accent: "1E40AF", pale: "DBEAFE", text: "172033", muted: "64748B" };
    case "creative":
      return { accent: "7C3AED", pale: "EDE9FE", text: "2E1065", muted: "6B7280" };
    case "school":
      return { accent: "0F766E", pale: "CCFBF1", text: "134E4A", muted: "64748B" };
    case "plain":
      return { accent: "111827", pale: "F3F4F6", text: "111827", muted: "6B7280" };
    default:
      return { accent: "334155", pale: "F1F5F9", text: "1E293B", muted: "64748B" };
  }
}

function runsForText(
  text: string,
  options: { bold?: boolean; italics?: boolean; size?: number; color?: string } = {},
) {
  const lines = text.split(/\r?\n/);
  return lines.map(
    (line, index) =>
      new TextRun({
        text: line || " ",
        break: index ? 1 : undefined,
        font: BODY_FONT,
        size: options.size ?? 21,
        bold: options.bold,
        italics: options.italics,
        color: options.color,
      }),
  );
}

function bodyParagraph(text: string, options: { bold?: boolean; italics?: boolean; color?: string } = {}) {
  return new Paragraph({
    children: runsForText(text, options),
    spacing: { after: 140, line: 320 },
    widowControl: true,
  });
}

function labelParagraph(label: string, accent: string) {
  return new Paragraph({
    children: [new TextRun({ text: label, bold: true, size: 24, color: accent, font: BODY_FONT })],
    spacing: { before: 180, after: 90 },
    keepNext: true,
  });
}

function tableCell(
  text: string,
  width: number,
  options: { header?: boolean; accent?: string; pale?: string } = {},
) {
  const paragraphs = text.split(/\r?\n/).map(
    (line) =>
      new Paragraph({
        children: [
          new TextRun({
            text: line || " ",
            font: BODY_FONT,
            size: options.header ? 19 : 18,
            bold: options.header,
            color: options.header ? options.accent : "1F2937",
          }),
        ],
        spacing: { after: 45, line: 260 },
      }),
  );
  return new TableCell({
    children: paragraphs,
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 90, bottom: 90, left: 110, right: 110 },
    shading: options.header
      ? { type: ShadingType.CLEAR, color: "auto", fill: options.pale ?? "F1F5F9" }
      : undefined,
  });
}

function columnWidths(columnCount: number, availableWidth: number): number[] {
  if (columnCount === 2) return [Math.round(availableWidth * 0.26), Math.round(availableWidth * 0.74)];
  const base = Math.floor(availableWidth / Math.max(1, columnCount));
  return Array.from({ length: columnCount }, (_, index) =>
    index === columnCount - 1 ? availableWidth - base * (columnCount - 1) : base,
  );
}

function createTable(
  columns: string[],
  rows: string[][],
  availableWidth: number,
  accent: string,
  pale: string,
) {
  const safeColumns = columns.length ? columns : ["内容"];
  const widths = columnWidths(safeColumns.length, availableWidth);
  const header = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: safeColumns.map((column, index) =>
      tableCell(column, widths[index], { header: true, accent, pale }),
    ),
  });
  const dataRows = rows.map(
    (row) =>
      new TableRow({
        children: safeColumns.map((_, index) => tableCell(row[index] ?? "", widths[index])),
      }),
  );
  return new Table({
    width: { size: availableWidth, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: [header, ...dataRows],
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
  });
}

function renderAssetGallery(
  block: Extract<ExportBlock, { kind: "assetGallery" }>,
  orientation: ExportDocument["options"]["orientation"],
  muted: string,
) {
  const children: Array<Paragraph | Table> = [];
  const maxWidth = orientation === "landscape" ? 900 : 590;
  const maxHeight = orientation === "landscape" ? 560 : 430;
  for (const asset of block.assets) {
    const image = decodeDataUrlImage(asset.dataUrl);
    if (image) {
      const fitted = fitImage(image.width, image.height, maxWidth, maxHeight);
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              type: image.type,
              data: image.data,
              transformation: fitted,
              altText: { name: asset.name, title: asset.name, description: asset.description || asset.name },
            }),
          ],
          spacing: { before: 140, after: 80 },
          keepNext: true,
        }),
      );
    }
    const caption = image ? `图：${asset.name}` : `素材引用：${asset.name}（${asset.mimeType}）`;
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: runsForText(caption, { italics: true, size: 18, color: muted }),
        spacing: { after: asset.description ? 40 : 150 },
        keepNext: Boolean(asset.description),
      }),
    );
    if (asset.description) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: runsForText(asset.description, { size: 18, color: muted }),
          spacing: { after: 150 },
        }),
      );
    }
  }
  return children;
}

function renderBlock(
  block: ExportBlock,
  availableWidth: number,
  document: ExportDocument,
  colors: ReturnType<typeof palette>,
): Array<Paragraph | Table> {
  const children: Array<Paragraph | Table> = [];
  if (block.label) children.push(labelParagraph(block.label, colors.accent));

  switch (block.kind) {
    case "paragraph":
      children.push(bodyParagraph(block.text));
      break;
    case "list":
      block.items.forEach((item, index) => {
        children.push(
          new Paragraph({
            children: runsForText(block.ordered ? `${index + 1}. ${item}` : item),
            bullet: block.ordered ? undefined : { level: 0 },
            spacing: { after: 85, line: 300 },
            widowControl: true,
          }),
        );
      });
      break;
    case "keyValue":
      children.push(
        createTable(
          ["项目", "内容"],
          block.rows.map((row) => [row.label, row.value]),
          availableWidth,
          colors.accent,
          colors.pale,
        ),
      );
      break;
    case "table":
      children.push(createTable(block.columns, block.rows, availableWidth, colors.accent, colors.pale));
      break;
    case "assetGallery":
      children.push(...renderAssetGallery(block, document.options.orientation, colors.muted));
      break;
  }
  children.push(new Paragraph({ spacing: { after: 80 } }));
  return children;
}

function headerFor(document: ExportDocument, muted: string) {
  if (!document.options.includeHeader) return undefined;
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: runsForText(document.metadata.projectName, { size: 17, color: muted }),
      }),
    ],
  });
}

function footerFor(document: ExportDocument, muted: string) {
  if (!document.options.includeFooter && !document.options.includePageNumbers) return undefined;
  const children: TextRun[] = [];
  if (document.options.includeFooter) {
    children.push(new TextRun({ text: "Idea Bubble 项目文档", font: BODY_FONT, size: 16, color: muted }));
  }
  if (document.options.includeFooter && document.options.includePageNumbers) {
    children.push(new TextRun({ text: "  ·  ", font: BODY_FONT, size: 16, color: muted }));
  }
  if (document.options.includePageNumbers) {
    children.push(
      new TextRun({
        children: ["第 ", PageNumber.CURRENT, " 页 / 共 ", PageNumber.TOTAL_PAGES, " 页"],
        font: BODY_FONT,
        size: 16,
        color: muted,
      }),
    );
  }
  return new Footer({
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children })],
  });
}

export async function renderDocx(document: ExportDocument): Promise<Uint8Array> {
  const fullFont = await loadDocumentFont();
  const font = await subsetFont(
    fullFont,
    `${JSON.stringify(document)} Idea Bubble 项目文档目录作者单位版本日期第页共页`,
    { targetFormat: "sfnt" },
  );
  const colors = palette(document.options.layout);
  const landscape = document.options.orientation === "landscape";
  const pageWidth = landscape ? A4_HEIGHT : A4_WIDTH;
  const pageHeight = landscape ? A4_WIDTH : A4_HEIGHT;
  const availableWidth = pageWidth - PAGE_MARGIN * 2;
  const children: Array<Paragraph | Table> = [];

  if (document.cover) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: document.cover.title,
            bold: true,
            size: 54,
            color: colors.accent,
            font: BODY_FONT,
          }),
        ],
        spacing: { before: 3_200, after: 360 },
        keepNext: true,
      }),
    );
    if (document.cover.subtitle) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: runsForText(document.cover.subtitle, { size: 28, color: colors.text }),
          spacing: { after: 1_700 },
        }),
      );
    } else {
      children.push(new Paragraph({ spacing: { after: 1_700 } }));
    }
    const coverDetails = [
      document.cover.author ? `作者：${document.cover.author}` : "",
      document.cover.organization ? `单位：${document.cover.organization}` : "",
      document.cover.versionName ? `版本：${document.cover.versionName}` : "",
      `日期：${document.cover.date}`,
    ].filter(Boolean);
    coverDetails.forEach((detail) => {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: runsForText(detail, { size: 21, color: colors.muted }),
          spacing: { after: 90 },
        }),
      );
    });
  }

  let forcePageBreak = Boolean(document.cover);
  if (document.options.includeTableOfContents && document.sections.length) {
    children.push(
      new Paragraph({
        text: "目录",
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: forcePageBreak,
        keepNext: true,
      }),
    );
    document.sections.forEach((section, index) => {
      children.push(
        new Paragraph({
          children: runsForText(`${index + 1}. ${section.title}`, { size: 22, color: colors.text }),
          spacing: { after: 110 },
        }),
      );
    });
    // This is deliberately a page-number-free static contents list. Word page
    // numbers are not known at generation time, so fabricated numbers are never emitted.
    forcePageBreak = true;
  }

  document.sections.forEach((section, index) => {
    children.push(
      new Paragraph({
        text: `${index + 1}. ${section.title}`,
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: forcePageBreak,
        keepNext: true,
      }),
    );
    forcePageBreak = false;
    section.blocks.forEach((block) => {
      children.push(...renderBlock(block, availableWidth, document, colors));
    });
  });

  const header = headerFor(document, colors.muted);
  const footer = footerFor(document, colors.muted);
  const doc = new Document({
    title: document.metadata.projectName,
    subject: "Idea Bubble 项目导出",
    creator: document.metadata.author || "Idea Bubble",
    description: "由 Idea Bubble 生成的项目计划文档",
    features: { updateFields: true },
    fonts: [{ name: BODY_FONT_NAME, data: font }],
    styles: {
      default: {
        document: {
          run: { font: BODY_FONT, size: 21, color: colors.text, language: { eastAsia: "zh-CN" } },
          paragraph: { spacing: { after: 120, line: 320 } },
        },
        title: { run: { font: BODY_FONT, size: 54, bold: true, color: colors.accent } },
        heading1: {
          run: { font: BODY_FONT, size: 32, bold: true, color: colors.accent },
          paragraph: { spacing: { before: 280, after: 180 }, keepNext: true, keepLines: true },
        },
        heading2: {
          run: { font: BODY_FONT, size: 25, bold: true, color: colors.accent },
          paragraph: { spacing: { before: 200, after: 120 }, keepNext: true, keepLines: true },
        },
      },
    },
    sections: [
      {
        properties: {
          titlePage: Boolean(document.cover),
          page: {
            size: {
              width: pageWidth,
              height: pageHeight,
              orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
            margin: {
              top: PAGE_MARGIN,
              right: PAGE_MARGIN,
              bottom: PAGE_MARGIN,
              left: PAGE_MARGIN,
              header: 420,
              footer: 420,
            },
          },
        },
        headers: header ? { default: header } : undefined,
        footers: footer ? { default: footer } : undefined,
        children,
      },
    ],
  });

  return new Uint8Array(await Packer.toBuffer(doc));
}
