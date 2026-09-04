import { sortWallQrProducts, WALL_QR_PAGE_HEIGHT_MM, WALL_QR_PAGE_WIDTH_MM, type WallQrLabelProduct } from "./wall-qr-label-layout";

export const TITLE_LABEL_WIDTH_MM = 186;
export const TITLE_LABEL_HEIGHT_MM = 40;
export const TITLE_LABEL_COLUMNS = 1;
export const TITLE_LABEL_ROWS = 6;
export const TITLE_LABELS_PER_PAGE = TITLE_LABEL_COLUMNS * TITLE_LABEL_ROWS;

const MM_TO_PT = 72 / 25.4;
const PAGE_WIDTH_PT = WALL_QR_PAGE_WIDTH_MM * MM_TO_PT;
const PAGE_HEIGHT_PT = WALL_QR_PAGE_HEIGHT_MM * MM_TO_PT;
const LABEL_WIDTH_PT = TITLE_LABEL_WIDTH_MM * MM_TO_PT;
const LABEL_HEIGHT_PT = TITLE_LABEL_HEIGHT_MM * MM_TO_PT;
const MARGIN_MM = 12;
const GUTTER_X_MM = 8;
const ROW_GAP_MM = 6;
const CROP_MARK_MM = 3;
const CROP_GAP_MM = 1;
const TEXT_INSET_MM = 6;
const FONT_SIZE = 24;
const LINE_HEIGHT = 28;
const CREDIT_FONT_SIZE = 11;
const CREDIT_LINE_HEIGHT = 14;
const CREDIT_GAP = 6;

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
  "'": 180,
  "(": 333,
  ")": 333,
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

const wrapTimes = (text: string, fontSize: number, maxWidth: number, maxLines: number): string[] => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (measureTimes(next, fontSize) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;

  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1] ?? "";
  let trimmed = last;
  while (trimmed.length > 1 && measureTimes(`${trimmed}...`, fontSize) > maxWidth) {
    trimmed = trimmed.slice(0, -1).trimEnd();
  }
  kept[maxLines - 1] = `${trimmed}...`;
  return kept;
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

const cellOrigin = (indexOnPage: number): { x: number; y: number } => {
  const col = indexOnPage % TITLE_LABEL_COLUMNS;
  const row = Math.floor(indexOnPage / TITLE_LABEL_COLUMNS);
  const gridWidthMm = TITLE_LABEL_COLUMNS * TITLE_LABEL_WIDTH_MM + (TITLE_LABEL_COLUMNS - 1) * GUTTER_X_MM;
  const originXmm = (WALL_QR_PAGE_WIDTH_MM - gridWidthMm) / 2;
  const originTopMm = MARGIN_MM + 4;
  const x = mm(originXmm + col * (TITLE_LABEL_WIDTH_MM + GUTTER_X_MM));
  const top = mm(originTopMm + row * (TITLE_LABEL_HEIGHT_MM + ROW_GAP_MM));
  const y = PAGE_HEIGHT_PT - top - LABEL_HEIGHT_PT;
  return { x, y };
};

const drawCropMarks = (x: number, y: number): string => {
  const mark = mm(CROP_MARK_MM);
  const gap = mm(CROP_GAP_MM);
  const top = y + LABEL_HEIGHT_PT;
  const right = x + LABEL_WIDTH_PT;
  const segments: Array<[number, number, number, number]> = [
    [x - gap - mark, top, x - gap, top],
    [x, top + gap, x, top + gap + mark],
    [right + gap, top, right + gap + mark, top],
    [right, top + gap, right, top + gap + mark],
    [x - gap - mark, y, x - gap, y],
    [x, y - gap - mark, x, y - gap],
    [right + gap, y, right + gap + mark, y],
    [right, y - gap - mark, right, y - gap],
  ];

  return [
    "0.6 w",
    "0 G",
    ...segments.map(
      ([x1, y1, x2, y2]) =>
        `${pdfNumber(x1)} ${pdfNumber(y1)} m ${pdfNumber(x2)} ${pdfNumber(y2)} l S`,
    ),
  ].join("\n");
};

const drawLabel = (title: string, credit: string | null | undefined, x: number, y: number): string => {
  const maxWidth = LABEL_WIDTH_PT - mm(TEXT_INSET_MM) * 2;
  const titleLines = wrapTimes(toWinAnsi(title), FONT_SIZE, maxWidth, 1);
  const creditText = credit?.trim() ? toWinAnsi(credit.trim()) : "";
  const creditLines = creditText ? wrapTimes(creditText, CREDIT_FONT_SIZE, maxWidth, 1) : [];
  const titleBlock = titleLines.length * LINE_HEIGHT;
  const creditBlock = creditLines.length > 0 ? CREDIT_GAP + creditLines.length * CREDIT_LINE_HEIGHT : 0;
  const blockHeight = titleBlock + creditBlock;
  const startY = y + (LABEL_HEIGHT_PT + blockHeight) / 2 - FONT_SIZE;

  const titleCommands = titleLines.map((line, lineIndex) => {
    const lineWidth = measureTimes(line, FONT_SIZE);
    const lineX = x + (LABEL_WIDTH_PT - lineWidth) / 2;
    const lineY = startY - lineIndex * LINE_HEIGHT;
    return `1 0 0 1 ${pdfNumber(lineX)} ${pdfNumber(lineY)} Tm (${pdfEscape(line)}) Tj`;
  });

  const creditStartY = startY - titleBlock - CREDIT_GAP + (LINE_HEIGHT - CREDIT_FONT_SIZE);
  const creditCommands = creditLines.map((line, lineIndex) => {
    const lineWidth = measureTimes(line, CREDIT_FONT_SIZE);
    const lineX = x + (LABEL_WIDTH_PT - lineWidth) / 2;
    const lineY = creditStartY - lineIndex * CREDIT_LINE_HEIGHT;
    return `1 0 0 1 ${pdfNumber(lineX)} ${pdfNumber(lineY)} Tm (${pdfEscape(line)}) Tj`;
  });

  return [
    "BT",
    `/F1 ${FONT_SIZE} Tf`,
    "0 g",
    ...titleCommands,
    ...(creditCommands.length > 0 ? [`/F2 ${CREDIT_FONT_SIZE} Tf`, ...creditCommands] : []),
    "ET",
  ].join("\n");
};

export const buildWallTitleLabelsPdf = (products: WallQrLabelProduct[]): Buffer => {
  const labels = sortWallQrProducts(products);
  const pdf = new PdfBuilder();
  const catalogId = pdf.reserve();
  const pagesId = pdf.reserve();
  const fontId = pdf.addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>");
  const italicFontId = pdf.addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >>");
  const pageMediaBox = `/MediaBox [0 0 ${pdfNumber(PAGE_WIDTH_PT)} ${pdfNumber(PAGE_HEIGHT_PT)}]`;
  const sheetCount = Math.max(1, Math.ceil(Math.max(labels.length, 1) / TITLE_LABELS_PER_PAGE));
  const pageIds: number[] = [];

  for (let sheet = 0; sheet < sheetCount; sheet += 1) {
    const slice = labels.slice(sheet * TITLE_LABELS_PER_PAGE, (sheet + 1) * TITLE_LABELS_PER_PAGE);
    const content: string[] = [];
    slice.forEach((product, indexOnPage) => {
      const { x, y } = cellOrigin(indexOnPage);
      content.push(drawCropMarks(x, y));
      content.push(drawLabel(product.title, product.credit_attribution, x, y));
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
