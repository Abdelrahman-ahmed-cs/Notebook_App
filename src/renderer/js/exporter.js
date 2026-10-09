// Rendering pages to bitmaps and assembling exports (PDF, PNG, print, thumbnails).
import { drawPaper } from './doc.js';
import * as pdf from './pdf.js';
import { loadImage } from './editor.js';

const { fabric } = window;

let staticCanvas = null;
function scratch(w, h) {
  if (!staticCanvas) staticCanvas = new fabric.StaticCanvas(null, { enableRetinaScaling: false, renderOnAddRemove: false });
  staticCanvas.setDimensions({ width: w, height: h });
  staticCanvas.setZoom(1);
  return staticCanvas;
}

/** Load a page's objects into the shared static canvas. Calls are serialised. */
let queue = Promise.resolve();
export function withPageObjects(page, fn) {
  const run = () => new Promise((resolve, reject) => {
    const sc = scratch(page.width, page.height);
    sc.clear();
    const go = async () => {
      try { resolve(await fn(sc)); } catch (e) { reject(e); }
    };
    if (page.data?.objects?.length) sc.loadFromJSON(page.data, go);
    else go();
  });
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

/** Draw the page background (paper, image or PDF page) at a scale. */
export async function renderBackground(editor, page, scale) {
  const w = Math.round(page.width * scale);
  const h = Math.round(page.height * scale);
  if (page.pdf) {
    const a = editor.assets.get(page.pdf.assetId);
    if (a) return pdf.renderPdfToCanvas(page.pdf.assetId, a.bytes, page.pdf.pageIndex, w, h);
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  drawPaper(ctx, page, scale);
  if (page.image) {
    const url = editor.assets.url(page.image.assetId);
    if (url) ctx.drawImage(await loadImage(url), 0, 0, w, h);
  }
  return c;
}

/** Full page bitmap (background + objects). */
export async function renderPage(editor, page, scale = 1) {
  const bg = await renderBackground(editor, page, scale);
  const ctx = bg.getContext('2d');
  if (page.data?.objects?.length) {
    const fg = await withPageObjects(page, (sc) => sc.toCanvasElement(scale));
    ctx.drawImage(fg, 0, 0, bg.width, bg.height);
  }
  return bg;
}

export function canvasToBytes(c, type = 'image/png', quality) {
  return new Promise((resolve) => c.toBlob(async (b) => resolve(new Uint8Array(await b.arrayBuffer())), type, quality));
}

// ---------- thumbnails ----------
const thumbJobs = [];
let thumbBusy = false;

export function requestThumb(editor, page, width, cb) {
  const cached = editor.thumbCache.get(page);
  if (cached) { cb(cached); return; }
  thumbJobs.push({ editor, page, width, cb });
  pumpThumbs();
}

async function pumpThumbs() {
  if (thumbBusy) return;
  thumbBusy = true;
  while (thumbJobs.length) {
    const job = thumbJobs.shift();
    const { editor, page } = job;
    if (editor.thumbCache.get(page)) { job.cb(editor.thumbCache.get(page)); continue; }
    try {
      const scale = (job.width * (window.devicePixelRatio || 1)) / page.width;
      const c = await renderPage(editor, page, scale);
      const url = c.toDataURL('image/jpeg', 0.82);
      editor.thumbCache.set(page, url);
      job.cb(url);
    } catch (e) {
      console.warn('thumbnail failed', e);
    }
    await new Promise((r) => setTimeout(r, 0));
  }
  thumbBusy = false;
}

// ---------- PDF ----------

function textLayer(sc) {
  const out = [];
  for (const o of sc.getObjects()) {
    if (o.type !== 'textbox' && o.type !== 'sticky') continue;
    const m = o.calcTransformMatrix();
    let y = -o.height / 2;
    (o.textLines || []).forEach((line, i) => {
      const lh = o.getHeightOfLine(i);
      const left = o._getLineLeftOffset(i) - o.width / 2;
      const p = fabric.util.transformPoint(new fabric.Point(left, y), m);
      out.push({ str: line, x: p.x, y: p.y, size: o.fontSize * Math.abs(o.scaleY) });
      y += lh;
    });
  }
  return out;
}

function linkLayer(sc, pageIndexById) {
  const out = [];
  for (const o of sc.getObjects()) {
    if (!o.linkPage && !o.linkUrl) continue;
    const r = o.getBoundingRect(true, true);
    const target = o.linkPage ? pageIndexById.get(o.linkPage) : null;
    out.push({ x: r.left, y: r.top, w: r.width, h: r.height, page: target ?? null, url: o.linkUrl || null });
  }
  return out;
}

/** Union bounding box of all objects, clamped to the page. */
function contentBox(sc, page) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const o of sc.getObjects()) {
    if (!o.visible || o.opacity === 0) continue;
    const r = o.getBoundingRect(true, true);
    const pad = 4 + (o.shadow ? o.shadow.blur + Math.abs(o.shadow.offsetX) + Math.abs(o.shadow.offsetY) : 0);
    x1 = Math.min(x1, r.left - pad);
    y1 = Math.min(y1, r.top - pad);
    x2 = Math.max(x2, r.left + r.width + pad);
    y2 = Math.max(y2, r.top + r.height + pad);
  }
  if (x1 === Infinity) return null;
  x1 = Math.max(0, Math.floor(x1));
  y1 = Math.max(0, Math.floor(y1));
  x2 = Math.min(page.width, Math.ceil(x2));
  y2 = Math.min(page.height, Math.ceil(y2));
  if (x2 <= x1 || y2 <= y1) return null;
  return { left: x1, top: y1, width: x2 - x1, height: y2 - y1 };
}

/**
 * Export pages to PDF bytes.
 * quality: overlay scale factor (1.5 compact, 2 standard, 3 high).
 */
export async function exportPdf(editor, pageIds, { quality = 2, onProgress } = {}) {
  const pageIndexById = new Map(pageIds.map((id, i) => [id, i]));
  const prepared = [];
  for (let i = 0; i < pageIds.length; i++) {
    const page = editor.page(pageIds[i]);
    const item = { width: page.width, height: page.height, bg: page.bg, texts: [], links: [], overlay: null };
    if (page.pdf) {
      const a = editor.assets.get(page.pdf.assetId);
      item.pdf = { assetId: page.pdf.assetId, bytes: a.bytes, pageIndex: page.pdf.pageIndex };
    } else if (page.image || (page.bg?.template && page.bg.template !== 'blank')) {
      const bg = await renderBackground(editor, page, page.image ? 2 : 1.5);
      item.backgroundPng = await canvasToBytes(bg);
    }
    if (page.data?.objects?.length) {
      await withPageObjects(page, async (sc) => {
        item.texts = textLayer(sc);
        item.links = linkLayer(sc, pageIndexById);
        const box = contentBox(sc, page);
        if (box) {
          // Hide tape while exporting? No: tape is part of the page as the user sees it.
          const c = sc.toCanvasElement(quality, box);
          item.overlay = { png: await canvasToBytes(c), x: box.left, y: box.top, w: box.width, h: box.height };
        }
      });
    }
    prepared.push(item);
    onProgress?.((i + 1) / pageIds.length * 0.7);
  }
  const outline = [];
  for (const o of editor.meta.outline || []) {
    if (pageIndexById.has(o.pageId)) outline.push({ title: o.title, pageIndex: pageIndexById.get(o.pageId), level: o.level || 0 });
  }
  pageIds.forEach((id, i) => {
    const p = editor.page(id);
    if (p.bookmark && !outline.some((o) => o.pageIndex === i)) outline.push({ title: p.label || `Page ${editor.pageIndex(id) + 1}`, pageIndex: i });
  });
  outline.sort((a, b) => a.pageIndex - b.pageIndex);
  return pdf.buildPdf(prepared, {
    title: editor.title,
    outline,
    onProgress: (k, n) => onProgress?.(0.7 + (k / n) * 0.3),
  });
}

export async function exportPng(editor, pageId, scale = 2) {
  const c = await renderPage(editor, editor.page(pageId), scale);
  return canvasToBytes(c);
}

/** Fill #print-root with page images and open the system print dialog. */
export async function printPages(editor, onProgress) {
  const root = document.getElementById('print-root');
  root.innerHTML = '';
  for (let i = 0; i < editor.pages.length; i++) {
    const c = await renderPage(editor, editor.pages[i], 2);
    const img = new Image();
    img.src = c.toDataURL('image/jpeg', 0.92);
    root.appendChild(img);
    onProgress?.((i + 1) / editor.pages.length);
  }
  await window.native.print();
  root.innerHTML = '';
}
