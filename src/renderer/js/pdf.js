// PDF import (pdf.js) and export (pdf-lib). Imported PDF pages keep their original
// vector content on export; only the annotations layer is rasterised, so files stay small.
const { pdfjsLib, PDFLib } = window;

pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';

const PX_PER_PT = 96 / 72;
const docCache = new Map(); // assetId -> Promise<PDFDocumentProxy>

export function loadPdf(assetId, bytes) {
  if (!docCache.has(assetId)) {
    // pdf.js transfers the buffer to its worker, so give it a copy.
    const task = pdfjsLib.getDocument({
      data: bytes.slice(),
      cMapUrl: 'vendor/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'vendor/standard_fonts/',
      isEvalSupported: false,
    });
    docCache.set(assetId, task.promise);
  }
  return docCache.get(assetId);
}

export function forgetPdf(assetId) {
  const p = docCache.get(assetId);
  if (p) p.then((d) => d.destroy()).catch(() => {});
  docCache.delete(assetId);
}

/** Page sizes (in app px at 96 dpi) for every page of a PDF. */
export async function pdfPageSizes(assetId, bytes) {
  const pdf = await loadPdf(assetId, bytes);
  const sizes = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: PX_PER_PT });
    sizes.push({ width: Math.round(vp.width), height: Math.round(vp.height) });
  }
  return sizes;
}

/** Outline (bookmarks) of a PDF flattened to {title, pageIndex, level}. */
export async function pdfOutline(assetId, bytes) {
  const pdf = await loadPdf(assetId, bytes);
  const outline = await pdf.getOutline().catch(() => null);
  const out = [];
  async function walk(items, level) {
    for (const it of items || []) {
      let pageIndex = null;
      try {
        let dest = it.dest;
        if (typeof dest === 'string') dest = await pdf.getDestination(dest);
        if (Array.isArray(dest)) pageIndex = await pdf.getPageIndex(dest[0]);
      } catch { /* unresolved destination */ }
      if (pageIndex !== null) out.push({ title: it.title, pageIndex, level });
      await walk(it.items, level + 1);
    }
  }
  await walk(outline, 0);
  return out;
}

const renderTasks = new WeakMap();

/** Render one PDF page into a canvas at the given display scale. */
export async function renderPdfPage(canvas, assetId, bytes, pageIndex, cssWidth, cssHeight, dpr) {
  const pdf = await loadPdf(assetId, bytes);
  const page = await pdf.getPage(pageIndex + 1);
  const base = page.getViewport({ scale: 1 });
  const scale = (cssWidth / base.width) * dpr;
  const vp = page.getViewport({ scale });
  const prev = renderTasks.get(canvas);
  if (prev) prev.cancel();
  const off = document.createElement('canvas');
  off.width = Math.round(vp.width);
  off.height = Math.round(vp.height);
  const task = page.render({ canvasContext: off.getContext('2d'), viewport: vp, background: 'white' });
  renderTasks.set(canvas, task);
  try {
    await task.promise;
  } catch (e) {
    if (e && e.name === 'RenderingCancelledException') return false;
    throw e;
  }
  canvas.width = off.width;
  canvas.height = off.height;
  canvas.style.width = cssWidth + 'px';
  canvas.style.height = cssHeight + 'px';
  canvas.getContext('2d').drawImage(off, 0, 0);
  return true;
}

/** Text items of a page in app px, for search and text-snapping highlights. */
export async function pdfTextItems(assetId, bytes, pageIndex) {
  const pdf = await loadPdf(assetId, bytes);
  const page = await pdf.getPage(pageIndex + 1);
  const vp = page.getViewport({ scale: PX_PER_PT });
  const content = await page.getTextContent();
  return content.items
    .filter((it) => it.str && it.str.trim())
    .map((it) => {
      const [, , , , e, f] = pdfjsLib.Util.transform(vp.transform, it.transform);
      const h = Math.hypot(it.transform[2], it.transform[3]) * PX_PER_PT;
      const family = content.styles?.[it.fontName]?.fontFamily || 'sans-serif';
      return { str: it.str, x: e, y: f - h, width: it.width * PX_PER_PT, height: h * 1.15, family };
    });
}

let measureCtx = null;
/** X offsets (page px, relative to item start) of every character boundary, from real font metrics. */
export function charOffsets(item) {
  if (item.offsets) return item.offsets;
  measureCtx ||= document.createElement('canvas').getContext('2d');
  measureCtx.font = `100px ${item.family || 'sans-serif'}`;
  const total = measureCtx.measureText(item.str).width || 1;
  item.offsets = [];
  for (let k = 0; k <= item.str.length; k++) item.offsets.push((measureCtx.measureText(item.str.slice(0, k)).width / total) * item.width);
  return item.offsets;
}

// ---------- export ----------

const hexToRgb = (hex) => {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(hex || '#ffffff');
  return m ? PDFLib.rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255) : PDFLib.rgb(1, 1, 1);
};

/** Render a PDF page into a fresh canvas of the given pixel size. */
export async function renderPdfToCanvas(assetId, bytes, pageIndex, width, height) {
  const pdf = await loadPdf(assetId, bytes);
  const page = await pdf.getPage(pageIndex + 1);
  const base = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: width / base.width });
  const c = document.createElement('canvas');
  c.width = Math.round(width);
  c.height = Math.round(height);
  await page.render({ canvasContext: c.getContext('2d'), viewport: vp, background: 'white' }).promise;
  return c;
}

/**
 * Build a PDF from prepared pages.
 * pages: [{ width, height, bg, pdf: {bytes, pageIndex, assetId} | null, backgroundPng,
 *           overlay: {png, x, y, w, h} | null, texts: [{str, x, y, size}], links: [{x,y,w,h,page|url}] }]
 * outline: [{ title, pageIndex, level }]
 */
export async function buildPdf(pages, { title = 'Notebook', outline = [], onProgress } = {}) {
  const { PDFDocument, StandardFonts, PDFName, PDFHexString, PDFString, PDFNumber } = PDFLib;
  const out = await PDFDocument.create();
  out.setTitle(title);
  out.setCreator('InkNote Studio');
  out.setProducer('InkNote Studio');
  const font = await out.embedFont(StandardFonts.Helvetica);
  const srcDocs = new Map();
  const made = [];

  for (let i = 0; i < pages.length; i++) {
    const pg = pages[i];
    const w = pg.width / PX_PER_PT;
    const h = pg.height / PX_PER_PT;
    const page = out.addPage([w, h]);
    made.push(page);

    if (pg.pdf) {
      let drawn = false;
      try {
        let src = srcDocs.get(pg.pdf.assetId);
        if (!src) {
          src = await PDFDocument.load(pg.pdf.bytes, { ignoreEncryption: true });
          srcDocs.set(pg.pdf.assetId, src);
        }
        const srcPage = src.getPage(pg.pdf.pageIndex);
        // pdf-lib embeds lazily and fails at save time on pages without content streams.
        if (!srcPage.node.Contents()) throw new Error('page has no content stream');
        const cb = srcPage.getCropBox();
        const embedded = await out.embedPage(srcPage, { left: cb.x, bottom: cb.y, right: cb.x + cb.width, top: cb.y + cb.height });
        // Honour /Rotate so the page matches what PDF.js displayed.
        const rot = ((srcPage.getRotation().angle % 360) + 360) % 360;
        const W0 = embedded.width;
        const H0 = embedded.height;
        const sx = (rot % 180 ? w / H0 : w / W0);
        const sy = (rot % 180 ? h / W0 : h / H0);
        const place = {
          0: { x: 0, y: 0, rotate: 0 },
          90: { x: 0, y: W0 * sy, rotate: -90 },
          180: { x: W0 * sx, y: H0 * sy, rotate: 180 },
          270: { x: H0 * sx, y: 0, rotate: 90 },
        }[rot] || { x: 0, y: 0, rotate: 0 };
        page.drawPage(embedded, { x: place.x, y: place.y, xScale: sx, yScale: sy, rotate: PDFLib.degrees(place.rotate) });
        drawn = true;
      } catch (err) {
        console.warn('Falling back to a rasterised PDF page', err);
      }
      if (!drawn) {
        // Blank or unusual pages pdf-lib cannot embed: draw what PDF.js renders instead.
        const c = await renderPdfToCanvas(pg.pdf.assetId, pg.pdf.bytes, pg.pdf.pageIndex, pg.width * 2, pg.height * 2);
        const jpg = await new Promise((r) => c.toBlob(async (b) => r(new Uint8Array(await b.arrayBuffer())), 'image/jpeg', 0.9));
        page.drawImage(await out.embedJpg(jpg), { x: 0, y: 0, width: w, height: h });
      }
    } else if (pg.backgroundPng) {
      const img = await out.embedPng(pg.backgroundPng);
      page.drawImage(img, { x: 0, y: 0, width: w, height: h });
    } else {
      page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: hexToRgb(pg.bg?.color) });
    }

    // Invisible text layer: typed text stays searchable and selectable in any PDF reader.
    for (const t of pg.texts || []) {
      const size = Math.max(1, t.size / PX_PER_PT);
      const str = t.str.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, ' ');
      if (!str.trim()) continue;
      try {
        page.drawText(str, { x: t.x / PX_PER_PT, y: h - t.y / PX_PER_PT - size * 0.85, size, font, opacity: 0 });
      } catch { /* glyph outside WinAnsi */ }
    }

    if (pg.overlay) {
      const o = pg.overlay;
      const img = await out.embedPng(o.png);
      page.drawImage(img, { x: o.x / PX_PER_PT, y: h - (o.y + o.h) / PX_PER_PT, width: o.w / PX_PER_PT, height: o.h / PX_PER_PT });
    }
    if (onProgress) onProgress(i + 1, pages.length);
  }

  const ctx = out.context;
  const dest = (idx) => ctx.obj([made[idx].ref, 'XYZ', null, null, null]);

  // Internal page links and web links.
  pages.forEach((pg, i) => {
    if (!pg.links?.length) return;
    const h = pg.height / PX_PER_PT;
    const annots = [];
    for (const l of pg.links) {
      const rect = [l.x / PX_PER_PT, h - (l.y + l.h) / PX_PER_PT, (l.x + l.w) / PX_PER_PT, h - l.y / PX_PER_PT].map((n) => PDFNumber.of(n));
      const a = ctx.obj({ Type: 'Annot', Subtype: 'Link', Border: [0, 0, 0] });
      a.set(PDFName.of('Rect'), ctx.obj(rect));
      if (l.page != null && made[l.page]) a.set(PDFName.of('Dest'), dest(l.page));
      else if (l.url) {
        const act = ctx.obj({ S: 'URI' });
        act.set(PDFName.of('URI'), PDFString.of(l.url));
        a.set(PDFName.of('A'), act);
      } else continue;
      annots.push(ctx.register(a));
    }
    if (annots.length) made[i].node.set(PDFName.of('Annots'), ctx.obj(annots));
  });

  // Outline (bookmarks panel in PDF readers).
  const items = outline.filter((o) => made[o.pageIndex]);
  if (items.length) {
    const outlinesRef = ctx.nextRef();
    const refs = items.map(() => ctx.nextRef());
    items.forEach((it, k) => {
      const d = ctx.obj({});
      d.set(PDFName.of('Title'), PDFHexString.fromText(it.title || `Page ${it.pageIndex + 1}`));
      d.set(PDFName.of('Parent'), outlinesRef);
      d.set(PDFName.of('Dest'), dest(it.pageIndex));
      if (k > 0) d.set(PDFName.of('Prev'), refs[k - 1]);
      if (k < refs.length - 1) d.set(PDFName.of('Next'), refs[k + 1]);
      ctx.assign(refs[k], d);
    });
    const root = ctx.obj({ Type: 'Outlines' });
    root.set(PDFName.of('First'), refs[0]);
    root.set(PDFName.of('Last'), refs[refs.length - 1]);
    root.set(PDFName.of('Count'), PDFNumber.of(refs.length));
    ctx.assign(outlinesRef, root);
    out.catalog.set(PDFName.of('Outlines'), outlinesRef);
    out.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
  }

  return out.save({ useObjectStreams: true });
}

export { PX_PER_PT };
