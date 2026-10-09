// Editor core: owns the document, one Fabric canvas per visible page (virtualised),
// zoom, granular undo/redo and committing canvas state back into immutable page records.
import { newPage, Assets, drawPaper, uid } from './doc.js';
import * as pdf from './pdf.js';

const { fabric } = window;

// Custom properties that must survive serialisation.
export const PROPS = [
  'id', 'assetId', 'name', 'isInk', 'inkType', 'inkPen', 'inkIsPen', 'inkPoints',
  'isTape', 'tapeRevealed', 'shapeKind', 'linkPage', 'linkUrl', 'listType', 'isSticky',
  'audioRef', 'textMark', 'styleId', 'direction', 'dirLocked', 'locked', 'lockMovementX', 'lockMovementY', 'lockScalingX', 'lockScalingY',
  'lockRotation', 'hasControls', 'selectable', 'cornerRadius', 'arrowHead',
];

const MAX_HISTORY = 300;
const PAGE_GAP = 28;

class Emitter {
  constructor() { this.handlers = {}; }
  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); return () => this.off(ev, fn); }
  off(ev, fn) { this.handlers[ev] = (this.handlers[ev] || []).filter((f) => f !== fn); }
  emit(ev, ...a) { (this.handlers[ev] || []).forEach((f) => f(...a)); }
}

export class Editor extends Emitter {
  constructor({ viewport, column }) {
    super();
    this.viewport = viewport;
    this.column = column;
    this.pages = [];
    this.assets = new Assets();
    this.title = 'Untitled notebook';
    this.filePath = null;
    this.meta = {};
    this.dirty = false;
    this.zoom = 1;
    this.views = new Map(); // pageId -> view
    this.activePageId = null;
    this.undoStack = [];
    this.redoStack = [];
    this.lastCommit = { key: null, time: 0 };
    this.toolController = null; // set by tools.js
    this.thumbCache = new WeakMap();

    this.io = new IntersectionObserver((entries) => this.onIntersect(entries), {
      root: viewport,
      rootMargin: '1400px 0px',
    });
    viewport.addEventListener('scroll', () => this.onScroll(), { passive: true });
    window.addEventListener('resize', () => this.emit('viewport'));
  }

  // ---------- document lifecycle ----------

  load({ title, pages, assets, meta = {}, filePath = null }) {
    this.unmountAll();
    if (this.assets !== assets) this.assets.clear();
    this.assets = assets;
    this.title = title || 'Untitled notebook';
    this.pages = pages;
    this.meta = meta;
    this.filePath = filePath;
    this.undoStack = [];
    this.redoStack = [];
    this.setDirty(false);
    this.activePageId = pages[0]?.id || null;
    this.layout();
    this.emit('document');
    this.emit('pages');
    this.emit('history');
  }

  newDocument(opts = {}) {
    const count = Math.max(1, opts.count || 1);
    const pages = Array.from({ length: count }, () => newPage(opts));
    this.load({ title: opts.title || 'Untitled notebook', pages, assets: new Assets() });
  }

  setDirty(d) {
    if (this.dirty === d) return;
    this.dirty = d;
    this.emit('dirty', d);
  }

  page(id) { return this.pages.find((p) => p.id === id); }
  pageIndex(id) { return this.pages.findIndex((p) => p.id === id); }
  get activePage() { return this.page(this.activePageId) || this.pages[0]; }
  get activeView() { return this.views.get(this.activePageId); }
  get activeCanvas() { return this.activeView?.fc || null; }

  setActivePage(id, { scroll = false } = {}) {
    if (!this.page(id)) return;
    const changed = this.activePageId !== id;
    this.activePageId = id;
    for (const [pid, v] of this.views) v.frame.classList.toggle('is-active', pid === id);
    if (scroll) this.scrollToPage(id);
    if (changed) this.emit('activePage', id);
  }

  // ---------- history ----------

  /** Snapshot the page list before a change. coalesceKey merges rapid repeats (slider drags). */
  pushHistory(before, coalesceKey = null) {
    const now = performance.now();
    if (coalesceKey && this.lastCommit.key === coalesceKey && now - this.lastCommit.time < 900) {
      this.lastCommit.time = now;
    } else {
      this.undoStack.push(before);
      if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
      this.lastCommit = { key: coalesceKey, time: now };
    }
    this.redoStack = [];
    this.setDirty(true);
    this.emit('history');
  }

  /** Replace the page list (structural edits). */
  setPages(pages, { coalesceKey = null, history = true } = {}) {
    const before = this.pages;
    this.pages = pages;
    if (history) this.pushHistory(before, coalesceKey);
    this.sync(before);
    this.emit('pages');
  }

  updatePage(id, patch, opts) {
    this.setPages(this.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)), opts);
  }

  /** Write a canvas' objects back into its page record. */
  commit(view, coalesceKey = null) {
    if (!view || !view.fc || view.loading) return;
    const data = view.fc.toObject(PROPS);
    data.objects = data.objects.filter((o) => !o.excludeFromExport);
    delete data.background;
    const before = this.pages;
    this.pages = this.pages.map((p) => (p.id === view.page.id ? { ...p, data } : p));
    view.page = this.page(view.page.id);
    view.dataRef = view.page.data;
    this.pushHistory(before, coalesceKey);
    this.emit('pageContent', view.page.id);
  }

  commitActive(coalesceKey) {
    const v = this.activeView;
    if (v) this.commit(v, coalesceKey);
  }

  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }

  undo() {
    if (!this.canUndo()) return;
    this.finishTextEditing();
    const prev = this.undoStack.pop();
    this.redoStack.push(this.pages);
    const before = this.pages;
    this.pages = prev;
    this.lastCommit = { key: null, time: 0 };
    this.sync(before);
    this.setDirty(true);
    this.emit('pages');
    this.emit('history');
  }

  redo() {
    if (!this.canRedo()) return;
    this.finishTextEditing();
    const next = this.redoStack.pop();
    this.undoStack.push(this.pages);
    const before = this.pages;
    this.pages = next;
    this.lastCommit = { key: null, time: 0 };
    this.sync(before);
    this.setDirty(true);
    this.emit('pages');
    this.emit('history');
  }

  /** Bring the DOM/canvases in line with this.pages after a change from `before`. */
  sync(before) {
    const sameStructure = before.length === this.pages.length && before.every((p, i) => p.id === this.pages[i].id);
    if (!sameStructure) {
      this.layout();
      return;
    }
    this.pages.forEach((p, i) => {
      const old = before[i];
      if (p === old) return;
      const v = this.views.get(p.id);
      if (!v) return;
      const sizeChanged = p.width !== old.width || p.height !== old.height;
      v.page = p;
      if (sizeChanged) {
        this.sizeFrame(v);
        if (v.fc) this.sizeCanvas(v);
      }
      if (sizeChanged || p.bg !== old.bg || p.pdf !== old.pdf || p.image !== old.image) this.renderBackground(v);
      if (v.fc && p.data !== v.dataRef) this.reloadCanvas(v);
      v.frame.classList.toggle('is-bookmarked', !!p.bookmark);
    });
  }

  // ---------- layout & virtualisation ----------

  layout() {
    const keep = new Set(this.pages.map((p) => p.id));
    for (const [id, v] of this.views) {
      if (!keep.has(id)) {
        this.unmount(v);
        this.io.unobserve(v.frame);
        v.frame.remove();
        this.views.delete(id);
      }
    }
    this.pages.forEach((p, i) => {
      let v = this.views.get(p.id);
      if (!v) {
        v = this.createView(p);
        this.views.set(p.id, v);
        this.io.observe(v.frame);
      } else if (v.page !== p) {
        const old = v.page;
        v.page = p;
        if (old.width !== p.width || old.height !== p.height) {
          this.sizeFrame(v);
          if (v.fc) this.sizeCanvas(v);
        }
        if (old.bg !== p.bg || old.pdf !== p.pdf || old.image !== p.image || old.width !== p.width) this.renderBackground(v);
        if (v.fc && p.data !== v.dataRef) this.reloadCanvas(v);
      }
      v.index = i;
      v.label.textContent = `${i + 1}`;
      v.frame.classList.toggle('is-bookmarked', !!p.bookmark);
      const slot = this.column.children[i];
      if (slot !== v.wrap) this.column.insertBefore(v.wrap, slot || null);
    });
    if (!this.page(this.activePageId)) this.activePageId = this.pages[0]?.id || null;
    for (const [pid, v] of this.views) v.frame.classList.toggle('is-active', pid === this.activePageId);
  }

  createView(page) {
    const wrap = document.createElement('div');
    wrap.className = 'page-wrap';
    const frame = document.createElement('div');
    frame.className = 'page-frame';
    frame.dataset.pageId = page.id;
    const bg = document.createElement('canvas');
    bg.className = 'page-bg';
    frame.appendChild(bg);
    const meta = document.createElement('div');
    meta.className = 'page-meta';
    const label = document.createElement('span');
    label.className = 'page-num';
    meta.appendChild(label);
    const add = document.createElement('button');
    add.className = 'page-add';
    add.type = 'button';
    add.title = 'Add a page after this one';
    add.innerHTML = '<span>+</span> Add page';
    add.addEventListener('click', () => this.emit('requestAddPageAfter', page.id));
    wrap.append(frame, meta);
    wrap.appendChild(add);
    const v = { page, wrap, frame, bg, label, fc: null, loading: false, dataRef: undefined, bgKey: '', index: 0 };
    this.sizeFrame(v);
    frame.addEventListener('pointerdown', () => this.setActivePage(v.page.id), true);
    return v;
  }

  sizeFrame(v) {
    v.frame.style.width = `${Math.round(v.page.width * this.zoom)}px`;
    v.frame.style.height = `${Math.round(v.page.height * this.zoom)}px`;
  }

  onIntersect(entries) {
    for (const e of entries) {
      const v = this.views.get(e.target.dataset.pageId);
      if (!v) continue;
      if (e.isIntersecting) this.mount(v);
      else this.unmount(v);
    }
  }

  onScroll() {
    // Track the page nearest the viewport centre as the "current" page for the counter.
    const mid = this.viewport.scrollTop + this.viewport.clientHeight / 2;
    let best = null;
    let bestD = Infinity;
    for (const v of this.views.values()) {
      const top = v.wrap.offsetTop;
      const d = Math.abs(top + v.wrap.offsetHeight / 2 - mid);
      if (d < bestD) { bestD = d; best = v; }
    }
    if (best && best.page.id !== this.visiblePageId) {
      this.visiblePageId = best.page.id;
      this.emit('visiblePage', best.page.id);
    }
    this.emit('viewport');
  }

  mount(v) {
    if (v.fc) return;
    this.renderBackground(v);
    const el = document.createElement('canvas');
    v.frame.appendChild(el);
    const fc = new fabric.Canvas(el, {
      width: Math.round(v.page.width * this.zoom),
      height: Math.round(v.page.height * this.zoom),
      enablePointerEvents: true,
      preserveObjectStacking: true,
      stopContextMenu: true,
      fireRightClick: true,
      selectionColor: 'rgba(0, 120, 212, 0.08)',
      selectionBorderColor: 'rgba(0, 120, 212, 0.9)',
      selectionLineWidth: 1,
      targetFindTolerance: 6,
      uniformScaling: true,
      controlsAboveOverlay: true,
    });
    fc.setZoom(this.zoom);
    fc.pageId = v.page.id;
    fc.view = v;
    v.fc = fc;
    fc.wrapperEl.classList.add('page-canvas');
    this.wireCanvas(v);
    this.reloadCanvas(v);
  }

  unmount(v) {
    if (!v.fc) return;
    if (v.fc.getActiveObject()?.isEditing) return; // never drop a canvas mid-typing
    if (this.activeView === v && v.fc.getActiveObject()) return;
    v.fc.dispose();
    this.clearCanvases(v);
    v.fc = null;
    v.dataRef = undefined;
  }

  unmountAll() {
    for (const v of this.views.values()) {
      if (v.fc) {
        v.fc.dispose();
        this.clearCanvases(v);
        v.fc = null;
      }
      this.io.unobserve(v.frame);
      v.wrap.remove();
    }
    this.views.clear();
  }

  /** Fabric's dispose() puts the original <canvas> back; remove everything but the background. */
  clearCanvases(v) {
    v.frame.querySelectorAll('.canvas-container').forEach((n) => n.remove());
    v.frame.querySelectorAll(':scope > canvas:not(.page-bg)').forEach((n) => n.remove());
  }

  reloadCanvas(v) {
    const fc = v.fc;
    const data = v.page.data;
    v.loading = true;
    v.dataRef = data;
    const done = () => {
      if (v.fc !== fc) return;
      v.loading = false;
      fc.getObjects().forEach((o) => this.decorate(o));
      if (this.toolController) this.toolController.applyToCanvas(fc);
      fc.requestRenderAll();
      this.emit('canvasReady', v);
    };
    fc.discardActiveObject();
    if (data && data.objects?.length) {
      fc.loadFromJSON(data, done);
    } else {
      fc.clear();
      done();
    }
  }

  /** Apply editor-wide control styling to an object. */
  decorate(o) {
    o.set({
      borderColor: '#0f6cbd',
      cornerColor: '#ffffff',
      cornerStrokeColor: '#0f6cbd',
      transparentCorners: false,
      cornerStyle: 'rect',
      cornerSize: 9,
      touchCornerSize: 24,
      padding: o.type === 'textbox' || o.type === 'sticky' ? 6 : 2,
      borderScaleFactor: 1,
      snapAngle: 45,
      snapThreshold: 4,
    });
    if (o.locked) o.set({ hasControls: false, lockMovementX: true, lockMovementY: true, lockScalingX: true, lockScalingY: true, lockRotation: true });
    if (!o.id) o.id = uid('ob');
  }

  wireCanvas(v) {
    const fc = v.fc;
    const changed = (e) => {
      if (v.loading || fc.__suspendCommit) return;
      if (e?.target?.excludeFromExport) return;
      this.commit(v);
    };
    fc.on('object:added', (e) => {
      if (e.target && !v.loading) this.decorate(e.target);
      changed(e);
    });
    fc.on('object:removed', changed);
    fc.on('object:modified', changed);
    fc.on('selection:created', (e) => this.onSelection(v, e));
    fc.on('selection:updated', (e) => this.onSelection(v, e));
    fc.on('selection:cleared', () => this.emit('selection', this.selection()));
    fc.on('text:editing:entered', () => this.emit('selection', this.selection()));
    fc.on('text:editing:exited', () => this.emit('selection', this.selection()));
    fc.on('text:selection:changed', () => this.emit('textSelection'));
    // Arabic / Hebrew typing switches the box to right-to-left automatically.
    fc.on('text:changed', (e) => {
      const o = e.target;
      if (!o || o.dirLocked) return;
      const m = /[A-Za-z\u00C0-\u024F\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.exec(o.text);
      const rtl = !!m && /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(m[0]);
      const dir = rtl ? 'rtl' : 'ltr';
      if (m && o.direction !== dir) {
        o.set({ direction: dir, textAlign: rtl ? (o.textAlign === 'left' ? 'right' : o.textAlign) : (o.textAlign === 'right' ? 'left' : o.textAlign) });
        o.initDimensions();
        fc.requestRenderAll();
        this.emit('selectionChanged', this.selection());
      }
    });
    fc.on('object:moving', () => this.emit('transforming'));
    fc.on('object:scaling', () => this.emit('transforming'));
    fc.on('object:rotating', () => this.emit('transforming'));
    fc.on('mouse:up', () => this.emit('transformEnd'));
    fc.on('after:render', () => this.emit('rendered', v));
  }

  onSelection(v, e) {
    // Only one page holds a selection at a time.
    for (const other of this.views.values()) {
      if (other !== v && other.fc && other.fc.getActiveObject()) {
        other.fc.discardActiveObject();
        other.fc.requestRenderAll();
      }
    }
    this.setActivePage(v.page.id);
    this.emit('selection', this.selection());
  }

  /** Current selection: { view, fc, object, objects } or null. */
  selection() {
    for (const v of this.views.values()) {
      const o = v.fc?.getActiveObject();
      if (o) {
        const objects = o.type === 'activeSelection' ? o.getObjects() : [o];
        return { view: v, fc: v.fc, object: o, objects };
      }
    }
    return null;
  }

  finishTextEditing() {
    for (const v of this.views.values()) {
      const o = v.fc?.getActiveObject();
      if (o?.isEditing) o.exitEditing();
    }
  }

  discardSelection() {
    for (const v of this.views.values()) {
      if (v.fc?.getActiveObject()) {
        v.fc.discardActiveObject();
        v.fc.requestRenderAll();
      }
    }
    this.emit('selection', null);
  }

  // ---------- backgrounds ----------

  async renderBackground(v) {
    const p = v.page;
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.round(p.width * this.zoom);
    const cssH = Math.round(p.height * this.zoom);
    // Keep background bitmaps within a sane pixel budget at high zoom.
    const budget = 24e6;
    const scale = Math.min(dpr, Math.sqrt(budget / (cssW * cssH)));
    const key = `${p.width}x${p.height}@${cssW}:${scale.toFixed(3)}|${JSON.stringify(p.bg)}|${p.pdf?.assetId}:${p.pdf?.pageIndex}|${p.image?.assetId}`;
    if (v.bgKey === key) return;
    v.bgKey = key;
    const c = v.bg;
    c.style.width = `${cssW}px`;
    c.style.height = `${cssH}px`;
    if (p.pdf) {
      const asset = this.assets.get(p.pdf.assetId);
      if (!asset) return;
      if (!c.width) { c.width = 1; c.height = 1; }
      v.frame.classList.add('is-loading');
      try {
        await pdf.renderPdfPage(c, p.pdf.assetId, asset.bytes, p.pdf.pageIndex, cssW, cssH, scale);
      } catch (err) {
        console.error('PDF render failed', err);
      } finally {
        if (v.bgKey === key) v.frame.classList.remove('is-loading');
      }
      return;
    }
    c.width = Math.round(cssW * scale);
    c.height = Math.round(cssH * scale);
    const ctx = c.getContext('2d');
    drawPaper(ctx, p, this.zoom * scale);
    if (p.image) {
      const url = this.assets.url(p.image.assetId);
      if (!url) return;
      const img = await loadImage(url);
      if (v.bgKey !== key) return;
      ctx.drawImage(img, 0, 0, c.width, c.height);
    }
  }

  // ---------- zoom ----------

  setZoom(z, anchor) {
    z = Math.min(5, Math.max(0.15, z));
    if (Math.abs(z - this.zoom) < 0.0005) return;
    const vp = this.viewport;
    const ax = anchor?.x ?? vp.clientWidth / 2;
    const ay = anchor?.y ?? vp.clientHeight / 2;
    const contentX = (vp.scrollLeft + ax) / this.zoom;
    const contentY = (vp.scrollTop + ay) / this.zoom;
    this.zoom = z;
    this.column.style.setProperty('--zoom', z);
    for (const v of this.views.values()) {
      this.sizeFrame(v);
      if (v.fc) this.sizeCanvas(v);
    }
    vp.scrollLeft = contentX * z - ax;
    vp.scrollTop = contentY * z - ay;
    clearTimeout(this.bgTimer);
    this.bgTimer = setTimeout(() => {
      for (const v of this.views.values()) if (v.fc) this.renderBackground(v);
    }, 120);
    this.emit('zoom', z);
  }

  sizeCanvas(v) {
    v.fc.setDimensions({ width: Math.round(v.page.width * this.zoom), height: Math.round(v.page.height * this.zoom) });
    v.fc.setZoom(this.zoom);
    v.fc.calcOffset();
    v.fc.requestRenderAll();
  }

  fitWidth(max = 5) {
    const widest = Math.max(...this.pages.map((p) => p.width), 600);
    this.setZoom(Math.min(max, (this.viewport.clientWidth - 96) / widest), { x: 0, y: 0 });
  }

  fitPage() {
    const p = this.activePage;
    if (!p) return;
    const z = Math.min((this.viewport.clientWidth - 96) / p.width, (this.viewport.clientHeight - 80) / p.height);
    this.setZoom(z);
    this.scrollToPage(p.id, 'center');
  }

  scrollToPage(id, block = 'start') {
    const v = this.views.get(id);
    if (!v) return;
    const top = v.wrap.offsetTop - (block === 'center' ? (this.viewport.clientHeight - v.wrap.offsetHeight) / 2 : 16);
    this.viewport.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
  }

  /** Centre of the visible part of a page, in page coordinates. */
  visibleCenter(id) {
    const v = this.views.get(id);
    const p = this.page(id);
    if (!v || !p) return { x: 0, y: 0 };
    const fr = v.frame.getBoundingClientRect();
    const vr = this.viewport.getBoundingClientRect();
    const top = Math.max(fr.top, vr.top);
    const bottom = Math.min(fr.bottom, vr.bottom);
    const left = Math.max(fr.left, vr.left);
    const right = Math.min(fr.right, vr.right);
    if (bottom <= top || right <= left) return { x: p.width / 2, y: p.height / 2 };
    return { x: ((left + right) / 2 - fr.left) / this.zoom, y: ((top + bottom) / 2 - fr.top) / this.zoom };
  }

  /** Bring a page into view, mount its canvas and resolve with the view. */
  async ensureMounted(id) {
    const v = this.views.get(id);
    if (!v) return null;
    if (!v.fc) this.mount(v);
    if (v.loading) await new Promise((r) => { const off = this.on('canvasReady', (x) => { if (x === v) { off(); r(); } }); });
    return v;
  }

  // ---------- page operations ----------

  insertPages(newPages, index = this.pages.length) {
    const pages = this.pages.slice();
    pages.splice(index, 0, ...newPages);
    this.setPages(pages);
    return newPages;
  }

  addPageAfter(id, opts) {
    const ref = this.page(id) || this.activePage;
    const idx = ref ? this.pageIndex(ref.id) + 1 : this.pages.length;
    const tmpl = opts || (ref ? { width: ref.width, height: ref.height, template: ref.bg.template, color: ref.bg.color } : {});
    const p = newPage(tmpl);
    this.insertPages([p], idx);
    this.setActivePage(p.id);
    requestAnimationFrame(() => this.scrollToPage(p.id));
    return p;
  }

  duplicatePages(ids) {
    this.finishTextEditing();
    const pages = this.pages.slice();
    let lastId = null;
    for (const id of ids) {
      const idx = pages.findIndex((p) => p.id === id);
      if (idx < 0) continue;
      const src = pages[idx];
      const copy = JSON.parse(JSON.stringify({ ...src, id: uid('pg') }));
      pages.splice(idx + 1, 0, copy);
      lastId = copy.id;
    }
    this.setPages(pages);
    if (lastId) this.setActivePage(lastId);
  }

  deletePages(ids) {
    const set = new Set(ids);
    let pages = this.pages.filter((p) => !set.has(p.id));
    if (!pages.length) {
      const ref = this.pages[0];
      pages = [newPage({ width: ref.width, height: ref.height, template: ref.bg.template, color: ref.bg.color })];
    }
    this.setPages(pages);
  }

  movePages(ids, toIndex) {
    const set = new Set(ids);
    const moving = this.pages.filter((p) => set.has(p.id));
    const rest = this.pages.filter((p) => !set.has(p.id));
    const before = this.pages.slice(0, toIndex).filter((p) => !set.has(p.id)).length;
    rest.splice(before, 0, ...moving);
    if (rest.every((p, i) => p === this.pages[i])) return;
    this.setPages(rest);
  }
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export { PAGE_GAP };
