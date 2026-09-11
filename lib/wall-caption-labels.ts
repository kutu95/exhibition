import {
  sortWallQrProducts,
  WALL_QR_PAGE_HEIGHT_MM,
  WALL_QR_PAGE_WIDTH_MM,
  type WallQrLabelProduct,
} from "./wall-qr-label-layout";

export const CAPTION_LABEL_WIDTH_MM = WALL_QR_PAGE_WIDTH_MM;
export const CAPTION_PAGE_WIDTH_MM = WALL_QR_PAGE_WIDTH_MM;
export const CAPTION_PAGE_HEIGHT_MM = WALL_QR_PAGE_HEIGHT_MM;

const MM_TO_PT = 72 / 25.4;
const PAGE_WIDTH_PT = CAPTION_PAGE_WIDTH_MM * MM_TO_PT;
const PAGE_HEIGHT_PT = CAPTION_PAGE_HEIGHT_MM * MM_TO_PT;

const PAGE_TOP_MARGIN_MM = 10;
const PAGE_BOTTOM_MARGIN_MM = 10;
const TEXT_INSET_MM = 16;
const LABEL_PAD_Y_MM = 8;
const SECTION_GAP_MM = 7;
const TRANSCRIPT_GAP_MM = 2;
const CUT_GAP_MM = 5;

const TITLE_SIZE = 18;
const TITLE_LEADING = 22;
const BODY_SIZE = 11;
const BODY_LEADING = 15;
const KICKER_SIZE = 8;
const KICKER_LEADING = 11;

const mm = (value: number): number => value * MM_TO_PT;

const pdfNumber = (value: number): string => {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
};

const pdfEscape = (text: string): string =>
  text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");

const toWinAnsi = (text: string): string =>
  [...text]
    .map((char) => {
      const code = char.charCodeAt(0);
      return code <= 255 ? char : "?";
    })
    .join("");

/** Times-Roman widths in 1000ths of an em. */
const TIMES_WIDTHS: Record<string, number> = {
  " ": 250,
  "!": 333,
  '"': 408,
  "#": 500,
  $: 500,
  "%": 833,
  "&": 778,
  "'": 180,
  "(": 333,
  ")": 333,
  "*": 500,
  "+": 564,
  ",": 250,
  "-": 333,
  ".": 250,
  "/": 278,
  "0": 500,
  "1": 500,
  "2": 500,
  "3": 500,
  "4": 500,
  "5": 500,
  "6": 500,
  "7": 500,
  "8": 500,
  "9": 500,
  ":": 278,
  ";": 278,
  "?": 444,
  A: 722,
  B: 667,
  C: 667,
  D: 722,
  E: 611,
  F: 556,
  G: 722,
  H: 722,
  I: 333,
  J: 389,
  K: 722,
  L: 611,
  M: 889,
  N: 722,
  O: 722,
  P: 556,
  Q: 722,
  R: 667,
  S: 556,
  T: 611,
  U: 722,
  V: 722,
  W: 944,
  X: 722,
  Y: 722,
  Z: 611,
  a: 444,
  b: 500,
  c: 444,
  d: 500,
  e: 444,
  f: 333,
  g: 500,
  h: 500,
  i: 278,
  j: 278,
  k: 500,
  l: 278,
  m: 778,
  n: 500,
  o: 500,
  p: 500,
  q: 500,
  r: 333,
  s: 389,
  t: 278,
  u: 500,
  v: 500,
  w: 722,
  x: 500,
  y: 500,
  z: 444,
};

const measureTimes = (text: string, fontSize: number): number => {
  let width = 0;
  for (const char of text) {
    width += TIMES_WIDTHS[char] ?? 500;
  }
  return (width * fontSize) / 1000;
};

const wrapTimes = (text: string, fontSize: number, maxWidth: number): string[] => {
  const paragraphs = toWinAnsi(text)
    .replaceAll("\r\n", "\n")
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return [];

  const lines: string[] = [];
  for (const [index, paragraph] of paragraphs.entries()) {
    if (index > 0) lines.push("");
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (measureTimes(next, fontSize) <= maxWidth) {
        current = next;
        continue;
      }
      if (current) lines.push(current);
      if (measureTimes(word, fontSize) > maxWidth) {
        let chunk = "";
        for (const char of word) {
          const trial = `${chunk}${char}`;
          if (chunk && measureTimes(trial, fontSize) > maxWidth) {
            lines.push(chunk);
            chunk = char;
          } else {
            chunk = trial;
          }
        }
        current = chunk;
      } else {
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
};

class PdfBuilder {
  private readonly objects: Array<Buffer | null> = [];

  reserve(): number {
    this.objects.push(null);
    return this.objects.length;
  }

  addObject(body: string | Buffer): number {
    const id = this.reserve();
    this.setObject(id, body);
    return id;
  }

  setObject(id: number, body: string | Buffer): void {
    this.objects[id - 1] = typeof body === "string" ? Buffer.from(body, "utf8") : body;
  }

  addStream(dictionary: string, data: Buffer): number {
    const header = Buffer.from(`<< ${dictionary} /Length ${data.length} >>\nstream\n`, "utf8");
    const footer = Buffer.from("\nendstream", "utf8");
    return this.addObject(Buffer.concat([header, data, footer]));
  }

  build(rootId: number): Buffer {
    const header = Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary");
    const parts: Buffer[] = [header];
    const offsets = [0];
    let offset = header.length;

    this.objects.forEach((body, index) => {
      if (!body) {
        throw new Error(`PDF object ${index + 1} was reserved but never written.`);
      }
      const object = Buffer.concat([
        Buffer.from(`${index + 1} 0 obj\n`, "utf8"),
        body,
        Buffer.from("\nendobj\n", "utf8"),
      ]);
      offsets.push(offset);
      parts.push(object);
      offset += object.length;
    });

    const xrefStart = offset;
    const xrefLines = ["xref", `0 ${this.objects.length + 1}`, "0000000000 65535 f "];
    for (let i = 1; i <= this.objects.length; i += 1) {
      xrefLines.push(`${String(offsets[i]).padStart(10, "0")} 00000 n `);
    }
    const xref = Buffer.from(`${xrefLines.join("\n")}\n`, "utf8");
    const trailer = Buffer.from(
      `trailer\n<< /Size ${this.objects.length + 1} /Root ${rootId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`,
      "utf8",
    );
    return Buffer.concat([...parts, xref, trailer]);
  }
}

export type WallCaptionLabelProduct = WallQrLabelProduct & {
  description?: string | null;
  audio_transcript?: string | null;
};

type LaidOutCaption = {
  product: WallCaptionLabelProduct;
  titleLines: string[];
  descriptionLines: string[];
  transcriptLines: string[];
  heightMm: number;
};

const TEXT_WIDTH_PT = PAGE_WIDTH_PT - mm(TEXT_INSET_MM) * 2;
const USABLE_HEIGHT_MM = CAPTION_PAGE_HEIGHT_MM - PAGE_TOP_MARGIN_MM - PAGE_BOTTOM_MARGIN_MM;

const linesHeightPt = (lineCount: number, leading: number): number =>
  lineCount <= 0 ? 0 : lineCount * leading;

const layoutCaption = (product: WallCaptionLabelProduct): LaidOutCaption => {
  const titleLines = wrapTimes(product.title, TITLE_SIZE, TEXT_WIDTH_PT);
  const descriptionLines = wrapTimes(product.description ?? "", BODY_SIZE, TEXT_WIDTH_PT);
  const transcriptLines = wrapTimes(product.audio_transcript ?? "", BODY_SIZE, TEXT_WIDTH_PT);

  let heightPt = mm(LABEL_PAD_Y_MM) * 2 + linesHeightPt(titleLines.length, TITLE_LEADING);
  if (descriptionLines.length > 0) {
    heightPt += mm(SECTION_GAP_MM) + linesHeightPt(descriptionLines.length, BODY_LEADING);
  }
  if (transcriptLines.length > 0) {
    heightPt += mm(SECTION_GAP_MM) + KICKER_LEADING + mm(TRANSCRIPT_GAP_MM) + linesHeightPt(transcriptLines.length, BODY_LEADING);
  }

  return {
    product,
    titleLines,
    descriptionLines,
    transcriptLines,
    heightMm: Math.min(USABLE_HEIGHT_MM, heightPt / MM_TO_PT),
  };
};

export const packWallCaptionPages = (captions: LaidOutCaption[]): LaidOutCaption[][] => {
  const pages: LaidOutCaption[][] = [];
  let current: LaidOutCaption[] = [];
  let usedMm = 0;

  const flush = () => {
    if (current.length === 0) return;
    pages.push(current);
    current = [];
    usedMm = 0;
  };

  for (const caption of captions) {
    const gapMm = current.length > 0 ? CUT_GAP_MM : 0;
    if (current.length > 0 && usedMm + gapMm + caption.heightMm > USABLE_HEIGHT_MM) {
      flush();
    }
    current.push(caption);
    usedMm += gapMm + caption.heightMm;
  }

  flush();
  return pages.length > 0 ? pages : [[]];
};

const drawTextLines = (
  lines: string[],
  fontSize: number,
  leading: number,
  startBaseline: number,
  font: "/F1" | "/F2",
): { commands: string[]; lastBaseline: number } => {
  const commands: string[] = [`${font} ${fontSize} Tf`, "0 g"];
  let y = startBaseline;
  lines.forEach((line, index) => {
    if (line) {
      commands.push(`1 0 0 1 ${pdfNumber(mm(TEXT_INSET_MM))} ${pdfNumber(y)} Tm (${pdfEscape(line)}) Tj`);
    }
    if (index < lines.length - 1) y -= leading;
  });
  return { commands, lastBaseline: y };
};

const drawCutLine = (y: number): string => {
  const tick = mm(3);
  return [
    "0.45 w",
    "0.45 G",
    "[2.5 2] 0 d",
    `${pdfNumber(0)} ${pdfNumber(y)} m ${pdfNumber(PAGE_WIDTH_PT)} ${pdfNumber(y)} l S`,
    "[] 0 d",
    "0.7 w",
    "0 G",
    `${pdfNumber(0)} ${pdfNumber(y - tick)} m ${pdfNumber(0)} ${pdfNumber(y + tick)} l S`,
    `${pdfNumber(PAGE_WIDTH_PT)} ${pdfNumber(y - tick)} m ${pdfNumber(PAGE_WIDTH_PT)} ${pdfNumber(y + tick)} l S`,
  ].join("\n");
};

const drawCaption = (caption: LaidOutCaption, topMm: number): string => {
  const topY = PAGE_HEIGHT_PT - mm(topMm);
  const bottomY = topY - mm(caption.heightMm);
  let baseline = topY - mm(LABEL_PAD_Y_MM) - TITLE_SIZE;

  const blocks: string[] = ["BT"];
  const title = drawTextLines(caption.titleLines, TITLE_SIZE, TITLE_LEADING, baseline, "/F1");
  blocks.push(...title.commands);
  baseline = title.lastBaseline;

  if (caption.descriptionLines.length > 0) {
    baseline -= mm(SECTION_GAP_MM);
    const description = drawTextLines(caption.descriptionLines, BODY_SIZE, BODY_LEADING, baseline, "/F1");
    blocks.push(...description.commands);
    baseline = description.lastBaseline;
  }

  if (caption.transcriptLines.length > 0) {
    baseline -= mm(SECTION_GAP_MM);
    blocks.push(
      `/F1 ${KICKER_SIZE} Tf`,
      "0.25 g",
      `1 0 0 1 ${pdfNumber(mm(TEXT_INSET_MM))} ${pdfNumber(baseline)} Tm (Transcript) Tj`,
    );
    baseline -= KICKER_LEADING + mm(TRANSCRIPT_GAP_MM);
    const transcript = drawTextLines(caption.transcriptLines, BODY_SIZE, BODY_LEADING, baseline, "/F2");
    blocks.push(...transcript.commands);
  }

  blocks.push("ET");
  blocks.push(drawCutLine(bottomY));
  return blocks.join("\n");
};

export const buildWallCaptionLabelsPdf = (products: WallCaptionLabelProduct[]): Buffer => {
  const captions = sortWallQrProducts(products).map(layoutCaption);
  const pages = packWallCaptionPages(captions);
  const pdf = new PdfBuilder();
  const catalogId = pdf.reserve();
  const pagesId = pdf.reserve();
  const fontId = pdf.addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>");
  const italicFontId = pdf.addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >>");
  const pageMediaBox = `/MediaBox [0 0 ${pdfNumber(PAGE_WIDTH_PT)} ${pdfNumber(PAGE_HEIGHT_PT)}]`;
  const pageIds: number[] = [];

  for (const sheet of pages) {
    const content: string[] = [];
    let topMm = PAGE_TOP_MARGIN_MM;
    sheet.forEach((caption, index) => {
      if (index > 0) topMm += CUT_GAP_MM;
      content.push(drawCaption(caption, topMm));
      topMm += caption.heightMm;
    });
    const contentsId = pdf.addStream("", Buffer.from(content.join("\n"), "utf8"));
    pageIds.push(
      pdf.addObject(
        `<< /Type /Page /Parent ${pagesId} 0 R ${pageMediaBox} /Resources << /Font << /F1 ${fontId} 0 R /F2 ${italicFontId} 0 R >> >> /Contents ${contentsId} 0 R >>`,
      ),
    );
  }

  pdf.setObject(
    pagesId,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
  );
  pdf.setObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  return pdf.build(catalogId);
};
