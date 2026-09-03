import { deflateSync } from "node:zlib";

import QRCode from "qrcode";

import { buildWallProductUrl } from "./exhibition-links";
import {
  sortWallQrProducts,
  WALL_QR_COLUMNS,
  WALL_QR_LABELS_PER_PAGE,
  WALL_QR_PAGE_HEIGHT_MM,
  WALL_QR_PAGE_WIDTH_MM,
  WALL_QR_SIZE_MM,
  type WallQrLabelProduct,
} from "./wall-qr-label-layout";

export {
  sortWallQrProducts,
  wallQrSheetPageCount,
  WALL_QR_COLUMNS,
  WALL_QR_LABELS_PER_PAGE,
  WALL_QR_PAGE_HEIGHT_MM,
  WALL_QR_PAGE_WIDTH_MM,
  WALL_QR_ROWS,
  WALL_QR_SIZE_MM,
  type WallQrLabelProduct,
} from "./wall-qr-label-layout";

const MM_TO_PT = 72 / 25.4;
const PAGE_WIDTH_PT = WALL_QR_PAGE_WIDTH_MM * MM_TO_PT;
const PAGE_HEIGHT_PT = WALL_QR_PAGE_HEIGHT_MM * MM_TO_PT;
const QR_SIZE_PT = WALL_QR_SIZE_MM * MM_TO_PT;
const MARGIN_MM = 12;
const GUTTER_X_MM = 10;
const LABEL_GAP_MM = 2;
const LABEL_HEIGHT_MM = 10;
const ROW_GAP_MM = 6;
const CROP_MARK_MM = 3;
const CROP_GAP_MM = 1;
const QR_MODULE_MARGIN = 4;
const QR_PIXELS_PER_MODULE = 16;

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

/** Helvetica widths in 1000ths of an em (WinAnsi subset used on labels). */
const HELVETICA_WIDTHS: Record<string, number> = {
  " ": 278,
  "!": 278,
  '"': 355,
  "%": 889,
  "&": 667,
  "'": 191,
  "(": 333,
  ")": 333,
  ",": 278,
  "-": 333,
  ".": 278,
  "/": 278,
  "0": 556,
  "1": 556,
  "2": 556,
  "3": 556,
  "4": 556,
  "5": 556,
  "6": 556,
  "7": 556,
  "8": 556,
  "9": 556,
  ":": 278,
  ";": 278,
  "?": 556,
  A: 667,
  B: 667,
  C: 722,
  D: 722,
  E: 667,
  F: 611,
  G: 778,
  H: 722,
  I: 278,
  J: 500,
  K: 667,
  L: 556,
  M: 833,
  N: 722,
  O: 778,
  P: 667,
  Q: 778,
  R: 722,
  S: 667,
  T: 611,
  U: 722,
  V: 667,
  W: 944,
  X: 667,
  Y: 667,
  Z: 611,
  a: 556,
  b: 556,
  c: 500,
  d: 556,
  e: 556,
  f: 278,
  g: 556,
  h: 556,
  i: 222,
  j: 222,
  k: 500,
  l: 222,
  m: 833,
  n: 556,
  o: 556,
  p: 556,
  q: 556,
  r: 333,
  s: 500,
  t: 278,
  u: 556,
  v: 500,
  w: 722,
  x: 500,
  y: 500,
  z: 500,
};

const measureHelvetica = (text: string, fontSize: number): number => {
  let width = 0;
  for (const char of text) {
    width += HELVETICA_WIDTHS[char] ?? 500;
  }
  return (width * fontSize) / 1000;
};

const wrapHelvetica = (text: string, fontSize: number, maxWidth: number, maxLines: number): string[] => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (measureHelvetica(next, fontSize) <= maxWidth) {
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
  while (trimmed.length > 1 && measureHelvetica(`${trimmed}...`, fontSize) > maxWidth) {
    trimmed = trimmed.slice(0, -1).trimEnd();
  }
  kept[maxLines - 1] = `${trimmed}...`;
  return kept;
};

const packQrBitmap = (url: string): { width: number; height: number; bytes: Buffer } => {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const modules = qr.modules;
  const moduleCount = modules.size;
  const totalModules = moduleCount + QR_MODULE_MARGIN * 2;
  const width = totalModules * QR_PIXELS_PER_MODULE;
  const bytesPerRow = Math.ceil(width / 8);
  const packed = Buffer.alloc(bytesPerRow * width, 0xff);

  const setBlack = (px: number, py: number) => {
    const byteIndex = py * bytesPerRow + (px >> 3);
    const bit = 7 - (px & 7);
    packed[byteIndex] &= ~(1 << bit);
  };

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!modules.get(row, col)) continue;
      const px0 = (col + QR_MODULE_MARGIN) * QR_PIXELS_PER_MODULE;
      const py0 = (row + QR_MODULE_MARGIN) * QR_PIXELS_PER_MODULE;
      for (let dy = 0; dy < QR_PIXELS_PER_MODULE; dy += 1) {
        for (let dx = 0; dx < QR_PIXELS_PER_MODULE; dx += 1) {
          setBlack(px0 + dx, py0 + dy);
        }
      }
    }
  }

  return { width, height: width, bytes: packed };
};

const drawCropMarks = (x: number, y: number): string => {
  const size = QR_SIZE_PT;
  const mark = mm(CROP_MARK_MM);
  const gap = mm(CROP_GAP_MM);
  const top = y + size;
  const right = x + size;
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
  const col = indexOnPage % WALL_QR_COLUMNS;
  const row = Math.floor(indexOnPage / WALL_QR_COLUMNS);
  const gridWidthMm = WALL_QR_COLUMNS * WALL_QR_SIZE_MM + (WALL_QR_COLUMNS - 1) * GUTTER_X_MM;
  const cellHeightMm = WALL_QR_SIZE_MM + LABEL_GAP_MM + LABEL_HEIGHT_MM + ROW_GAP_MM;
  const originXmm = (WALL_QR_PAGE_WIDTH_MM - gridWidthMm) / 2;
  const originTopMm = MARGIN_MM + 8;
  const x = mm(originXmm + col * (WALL_QR_SIZE_MM + GUTTER_X_MM));
  const top = mm(originTopMm + row * cellHeightMm);
  const y = PAGE_HEIGHT_PT - top - QR_SIZE_PT;
  return { x, y };
};

const labelCaption = (product: WallQrLabelProduct): string => {
  const privateMark = product.visibility === "vault" ? " - private" : "";
  return `${product.title}${privateMark}`;
};

const drawLabelText = (product: WallQrLabelProduct, x: number, y: number, index: number): string => {
  const caption = toWinAnsi(labelCaption(product));
  const lines = wrapHelvetica(caption, 8, QR_SIZE_PT, 2);
  const location = toWinAnsi(product.location_tag?.trim() || "Other");
  const textY = y - mm(LABEL_GAP_MM) - 8;
  const lineCommands = lines.map((line, lineIndex) => {
    const lineY = textY - lineIndex * 10;
    return `1 0 0 1 ${pdfNumber(x)} ${pdfNumber(lineY)} Tm (${pdfEscape(line)}) Tj`;
  });
  const metaY = y - mm(LABEL_GAP_MM + LABEL_HEIGHT_MM) + 2;
  return [
    "BT",
    "/F1 8 Tf",
    "0 g",
    ...lineCommands,
    "/F1 6 Tf",
    "0.35 g",
    `1 0 0 1 ${pdfNumber(x)} ${pdfNumber(metaY)} Tm (${pdfEscape(`${index}. ${location}`)}) Tj`,
    "ET",
  ].join("\n");
};

const buildIndexContent = (products: WallQrLabelProduct[]): string => {
  const commands: string[] = [
    "BT",
    "/F2 18 Tf",
    "0 g",
    `1 0 0 1 ${pdfNumber(mm(16))} ${pdfNumber(PAGE_HEIGHT_PT - mm(22))} Tm (Wall QR labels) Tj`,
    "/F1 10 Tf",
    `1 0 0 1 ${pdfNumber(mm(16))} ${pdfNumber(PAGE_HEIGHT_PT - mm(30))} Tm (The Georgette 150th) Tj`,
    "/F1 9 Tf",
    `1 0 0 1 ${pdfNumber(mm(16))} ${pdfNumber(PAGE_HEIGHT_PT - mm(40))} Tm (${pdfEscape("Print at 100% / Actual size. Do not scale to fit the page.")}) Tj`,
    `1 0 0 1 ${pdfNumber(mm(16))} ${pdfNumber(PAGE_HEIGHT_PT - mm(46))} Tm (${pdfEscape("Each square is 5 cm by 5 cm. Cut on the crop marks.")}) Tj`,
    `1 0 0 1 ${pdfNumber(mm(16))} ${pdfNumber(PAGE_HEIGHT_PT - mm(52))} Tm (${pdfEscape("The title under each square is for matching. Trim it off before pasting if you want QR only.")}) Tj`,
    `1 0 0 1 ${pdfNumber(mm(16))} ${pdfNumber(PAGE_HEIGHT_PT - mm(58))} Tm (${pdfEscape(`${products.length} photographs / ${WALL_QR_LABELS_PER_PAGE} labels per A4 sheet`)}) Tj`,
    "ET",
  ];

  const colWidth = mm(58);
  const colGap = mm(4);
  const startY = PAGE_HEIGHT_PT - mm(70);
  const lineHeight = 11;
  const rowsPerColumn = 26;

  products.forEach((product, index) => {
    const col = Math.floor(index / rowsPerColumn);
    const row = index % rowsPerColumn;
    const x = mm(16) + col * (colWidth + colGap);
    const y = startY - row * lineHeight;
    const sheetPage = 2 + Math.floor(index / WALL_QR_LABELS_PER_PAGE);
    const title = toWinAnsi(product.title);
    const mark = product.visibility === "vault" ? " *" : "";
    const line = wrapHelvetica(`${index + 1}. ${title}${mark}  p.${sheetPage}`, 8, colWidth, 1)[0] ?? "";
    commands.push(
      "BT",
      "/F1 8 Tf",
      "0 g",
      `1 0 0 1 ${pdfNumber(x)} ${pdfNumber(y)} Tm (${pdfEscape(line)}) Tj`,
      "ET",
    );
  });

  commands.push(
    "BT",
    "/F1 8 Tf",
    "0.35 g",
    `1 0 0 1 ${pdfNumber(mm(16))} ${pdfNumber(mm(14))} Tm (${pdfEscape("* Private collection. Skip these if they are not hung on the public wall.")}) Tj`,
    "ET",
  );

  return commands.join("\n");
};

const pageMediaBox = `/MediaBox [0 0 ${pdfNumber(PAGE_WIDTH_PT)} ${pdfNumber(PAGE_HEIGHT_PT)}]`;

export const buildWallQrLabelsPdf = (products: WallQrLabelProduct[]): Buffer => {
  const labels = sortWallQrProducts(products);
  const pdf = new PdfBuilder();
  const catalogId = pdf.reserve();
  const pagesId = pdf.reserve();
  const fontRegular = pdf.addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBold = pdf.addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const imageIds = labels.map((product) => {
    const url = buildWallProductUrl(product.slug);
    const bitmap = packQrBitmap(url);
    const compressed = deflateSync(bitmap.bytes, { level: 9 });
    return pdf.addStream(
      `/Type /XObject /Subtype /Image /Width ${bitmap.width} /Height ${bitmap.height} /ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /FlateDecode`,
      compressed,
    );
  });

  const indexContentId = pdf.addStream("", Buffer.from(buildIndexContent(labels), "utf8"));
  const indexPageId = pdf.addObject(
    `<< /Type /Page /Parent ${pagesId} 0 R ${pageMediaBox} /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${indexContentId} 0 R >>`,
  );

  const sheetPageIds: number[] = [];
  const sheetCount = Math.max(0, Math.ceil(labels.length / WALL_QR_LABELS_PER_PAGE));

  for (let sheet = 0; sheet < sheetCount; sheet += 1) {
    const start = sheet * WALL_QR_LABELS_PER_PAGE;
    const slice = labels.slice(start, start + WALL_QR_LABELS_PER_PAGE);
    const xObjectEntries = slice
      .map((_, indexOnPage) => `/Im${indexOnPage} ${imageIds[start + indexOnPage]} 0 R`)
      .join(" ");

    const content: string[] = [];
    slice.forEach((product, indexOnPage) => {
      const { x, y } = cellOrigin(indexOnPage);
      const globalIndex = start + indexOnPage + 1;
      content.push(drawCropMarks(x, y));
      content.push("q");
      content.push(
        `${pdfNumber(QR_SIZE_PT)} 0 0 ${pdfNumber(QR_SIZE_PT)} ${pdfNumber(x)} ${pdfNumber(y)} cm /Im${indexOnPage} Do`,
      );
      content.push("Q");
      content.push(drawLabelText(product, x, y, globalIndex));
    });

    content.push(
      "BT",
      "/F1 8 Tf",
      "0.35 g",
      `1 0 0 1 ${pdfNumber(mm(16))} ${pdfNumber(mm(10))} Tm (${pdfEscape(`Sheet ${sheet + 1} of ${sheetCount} - cut to 5 cm x 5 cm - print at actual size`)}) Tj`,
      "ET",
    );

    const contentsId = pdf.addStream("", Buffer.from(content.join("\n"), "utf8"));
    sheetPageIds.push(
      pdf.addObject(
        `<< /Type /Page /Parent ${pagesId} 0 R ${pageMediaBox} /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> /XObject << ${xObjectEntries} >> >> /Contents ${contentsId} 0 R >>`,
      ),
    );
  }

  const pageIds = [indexPageId, ...sheetPageIds];
  pdf.setObject(
    pagesId,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
  );
  pdf.setObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  return pdf.build(catalogId);
};
