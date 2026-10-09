// Document model, assets and the .inknote file format.
// .inknote is an open ZIP container: notebook.json + assets/<id>.<ext>.
const { JSZip } = window;

export const FORMAT_VERSION = 1;

export const PAGE_SIZES = {
  a4: { label: 'A4', width: 794, height: 1123 },
  a5: { label: 'A5', width: 559, height: 794 },
  letter: { label: 'US Letter', width: 816, height: 1056 },
  legal: { label: 'US Legal', width: 816, height: 1344 },
  a3: { label: 'A3', width: 1123, height: 1587 },
  widescreen: { label: 'Slide 16:9', width: 1280, height: 720 },
  square: { label: 'Square', width: 1080, height: 1080 },
};

export const PAPER_TEMPLATES = {
  blank: 'Blank',
  lined: 'Ruled',
  narrow: 'Narrow ruled',
  grid: 'Grid',
  dotted: 'Dot grid',
  cornell: 'Cornell notes',
  music: 'Music staff',
  isometric: 'Isometric dots',
  todo: 'Checklist',
};

export const PAPER_COLORS = ['#ffffff', '#fbf8ef', '#f4f1e8', '#eef3f7', '#f1f5ee', '#2b2d31', '#1b1c1f'];

let seq = 0;
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function newPage({ size = 'a4', landscape = false, template = 'blank', color = '#ffffff', width, height } = {}) {
  const s = PAGE_SIZES[size] || PAGE_SIZES.a4;
  let w = width || s.width;
  let h = height || s.height;
  if (landscape && w < h) [w, h] = [h, w];
  return {
    id: uid('pg'),
    width: w,
    height: h,
    bg: { color, template, spacing: 32 },
    pdf: null, // { assetId, pageIndex }
    image: null, // { assetId } full-page image background
    data: null, // fabric JSON of the page's objects
    bookmark: false,
    label: '',
  };
}

export class Assets {
  constructor() {
    this.map = new Map(); // id -> { mime, bytes, url }
  }

  add(bytes, mime, id = uid('as')) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const url = URL.createObjectURL(new Blob([u8], { type: mime }));
    this.map.set(id, { mime, bytes: u8, url });
    return id;
  }

  get(id) { return this.map.get(id); }
  url(id) { return this.map.get(id)?.url; }

  clear() {
    for (const a of this.map.values()) URL.revokeObjectURL(a.url);
    this.map.clear();
  }

  /** Lookup by object URL (fabric images keep the URL as their src). */
  idForUrl(url) {
    for (const [id, a] of this.map) if (a.url === url) return id;
    return null;
  }
}

const EXT = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
  'image/svg+xml': 'svg', 'image/bmp': 'bmp', 'application/pdf': 'pdf', 'audio/webm': 'webm',
};
export const MIME_BY_EXT = Object.fromEntries(Object.entries(EXT).map(([m, e]) => [e, m]));
MIME_BY_EXT.jpeg = 'image/jpeg';

/** Walk fabric object JSON (incl. groups) and replace image src values. */
function mapImageSrc(objects, fn) {
  for (const o of objects || []) {
    if (o.type === 'image' && o.src) o.src = fn(o);
    if (o.objects) mapImageSrc(o.objects, fn);
    if (o.clipPath && o.clipPath.objects) mapImageSrc(o.clipPath.objects, fn);
  }
}

function collectAssetIds(pages) {
  const used = new Set();
  for (const p of pages) {
    if (p.pdf) used.add(p.pdf.assetId);
    if (p.image) used.add(p.image.assetId);
    const walk = (objs) => {
      for (const o of objs || []) {
        if (o.assetId) used.add(o.assetId);
        if (o.objects) walk(o.objects);
      }
    };
    walk(p.data?.objects);
  }
  return used;
}

export async function serialize({ title, pages, assets, meta = {} }) {
  const zip = new JSZip();
  const used = collectAssetIds(pages);
  for (const r of meta.recordings || []) used.add(r.assetId);
  const outPages = pages.map((p) => {
    const copy = JSON.parse(JSON.stringify(p));
    if (copy.data) mapImageSrc(copy.data.objects, (o) => (o.assetId ? `asset:${o.assetId}` : o.src));
    return copy;
  });
  const assetIndex = {};
  for (const id of used) {
    const a = assets.get(id);
    if (!a) continue;
    const file = `assets/${id}.${EXT[a.mime] || 'bin'}`;
    assetIndex[id] = { file, mime: a.mime };
    zip.file(file, a.bytes, { binary: true, compression: a.mime === 'application/pdf' ? 'DEFLATE' : 'STORE' });
  }
  const json = { format: 'inknote', version: FORMAT_VERSION, title, savedAt: new Date().toISOString(), assets: assetIndex, pages: outPages, meta };
  zip.file('notebook.json', JSON.stringify(json));
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export async function deserialize(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  const entry = zip.file('notebook.json');
  if (!entry) throw new Error('This file is not an InkNote notebook (notebook.json is missing).');
  const json = JSON.parse(await entry.async('string'));
  if (json.format !== 'inknote') throw new Error('Unknown notebook format.');
  const assets = new Assets();
  for (const [id, info] of Object.entries(json.assets || {})) {
    const f = zip.file(info.file);
    if (f) assets.add(await f.async('uint8array'), info.mime, id);
  }
  for (const p of json.pages) {
    if (p.data) mapImageSrc(p.data.objects, (o) => (o.assetId && assets.url(o.assetId)) || o.src);
  }
  return { title: json.title, pages: json.pages, assets, meta: json.meta || {} };
}

// ---------- paper templates ----------

/** Draw a page background (paper colour + template lines) on a 2D context in page units. */
export function drawPaper(ctx, page, scale) {
  const { width: w, height: h } = page;
  const bg = page.bg || {};
  ctx.save();
  ctx.scale(scale, scale);
  ctx.fillStyle = bg.color || '#ffffff';
  ctx.fillRect(0, 0, w, h);
  const dark = isDark(bg.color);
  const line = dark ? 'rgba(255,255,255,0.16)' : 'rgba(60,90,130,0.22)';
  const strong = dark ? 'rgba(255,120,120,0.35)' : 'rgba(210,80,80,0.45)';
  const s = bg.spacing || 32;
  // Keep hairlines visible at any scale (thumbnails render at ~0.1x).
  ctx.lineWidth = Math.max(1, 0.85 / scale);
  const dotR = Math.max(1.1, 1.1 / scale);
  ctx.strokeStyle = line;
  ctx.fillStyle = line;
  const hLines = (gap, top = gap * 3) => {
    ctx.beginPath();
    for (let y = top; y < h - gap / 2; y += gap) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  };
  switch (bg.template) {
    case 'lined':
      hLines(s);
      ctx.strokeStyle = strong;
      ctx.beginPath(); ctx.moveTo(s * 2.5, 0); ctx.lineTo(s * 2.5, h); ctx.stroke();
      break;
    case 'narrow':
      hLines(s * 0.75);
      break;
    case 'grid': {
      ctx.beginPath();
      for (let x = s / 2; x < w; x += s / 1.25) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let y = s / 2; y < h; y += s / 1.25) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();
      break;
    }
    case 'dotted': {
      const g = s / 1.25;
      for (let x = g / 2; x < w; x += g) for (let y = g / 2; y < h; y += g) { ctx.beginPath(); ctx.arc(x, y, dotR, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'isometric': {
      const g = s / 1.25;
      const rowH = g * Math.sin(Math.PI / 3);
      let row = 0;
      for (let y = g / 2; y < h; y += rowH, row++) {
        for (let x = (row % 2 ? g / 2 : 0) + g / 2; x < w; x += g) { ctx.beginPath(); ctx.arc(x, y, dotR, 0, Math.PI * 2); ctx.fill(); }
      }
      break;
    }
    case 'cornell': {
      const top = s * 3;
      hLines(s, top + s);
      ctx.strokeStyle = strong;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, top); ctx.lineTo(w, top);
      ctx.moveTo(w * 0.3, top); ctx.lineTo(w * 0.3, h * 0.78);
      ctx.moveTo(0, h * 0.78); ctx.lineTo(w, h * 0.78);
      ctx.stroke();
      break;
    }
    case 'music': {
      const gap = 9;
      ctx.beginPath();
      for (let y = s * 2.5; y + gap * 4 < h - s; y += gap * 4 + s * 1.6) {
        for (let k = 0; k < 5; k++) { ctx.moveTo(s, y + k * gap); ctx.lineTo(w - s, y + k * gap); }
      }
      ctx.stroke();
      break;
    }
    case 'todo': {
      for (let y = s * 3; y < h - s; y += s) {
        ctx.beginPath(); ctx.moveTo(s * 2.2, y); ctx.lineTo(w - s, y); ctx.stroke();
        ctx.strokeRect(s * 0.9, y - s * 0.62, s * 0.45, s * 0.45);
      }
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

export function isDark(color) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(color || '#ffffff');
  if (!m) return false;
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16));
  return (r * 299 + g * 587 + b * 114) / 1000 < 110;
}
