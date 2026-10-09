// Tool controller: routes pointer input on page canvases to the active tool.
import * as ink from './ink.js';
import { uid } from './doc.js';
import * as pdf from './pdf.js';

const { fabric } = window;

export const DEFAULT_TOOLS = {
  pen: {
    type: 'fountain', color: '#1f1f1f', size: 3.2, opacity: 1,
    ...pick(ink.PEN_TYPES.fountain), simulatePressure: true, holdToShape: true, scribbleErase: true,
    swatches: ['#1f1f1f', '#1d4ed8', '#d92d20', '#15803d', '#ea580c'],
    sizes: [1.8, 3.2, 6],
  },
  highlighter: {
    type: 'highlighter', color: '#ffe45c', size: 18, opacity: 0.38,
    ...pick(ink.PEN_TYPES.highlighter), simulatePressure: false, behindInk: true, autoStraight: true, holdToShape: true,
    snapText: true, markStyle: 'highlight',
    swatches: ['#ffe45c', '#9be7a0', '#ffa3c7', '#9ccbff', '#ffb366'],
    sizes: [10, 18, 28],
  },
  eraser: { mode: 'stroke', size: 14, filter: 'all', autoDeselect: false },
  lasso: { filter: 'all' },
  shape: { kind: 'rect', fill: '#ffffff00', stroke: '#1f1f1f', strokeWidth: 2.5, dash: 'solid' },
  laser: { color: '#e5372e' },
  tape: { color: '#7fb8ee' },
};

function pick(t) {
  const { thinning, smoothing, streamline, taperStart, taperEnd } = t;
  return { thinning, smoothing, streamline, taperStart, taperEnd };
}

const INK_TOOLS = new Set(['pen', 'highlighter']);
const GUIDE = '#e5007e';

export class ToolController {
  constructor(editor, settings) {
    this.ed = editor;
    this.tool = 'select';
    this.prevTool = 'select';
    this.cfg = structuredClone(DEFAULT_TOOLS);
    if (settings) this.load(settings);
    this.spaceDown = false;
    this.listeners = [];
    editor.toolController = this;
    editor.on('canvasReady', (v) => this.wire(v));
  }

  load(saved) {
    for (const k of Object.keys(this.cfg)) {
      if (saved[k]) this.cfg[k] = { ...this.cfg[k], ...saved[k] };
    }
  }

  on(fn) { this.listeners.push(fn); }
  notify() { this.listeners.forEach((f) => f(this.tool, this.cfg)); }

  setTool(tool) {
    if (tool === this.tool) return;
    if (tool !== 'eraser') this.prevTool = tool;
    this.tool = tool;
    if (tool !== 'select' && tool !== 'lasso') this.ed.discardSelection();
    if (tool !== 'text') this.ed.finishTextEditing();
    for (const v of this.ed.views.values()) if (v.fc) this.applyToCanvas(v.fc);
    document.body.dataset.tool = tool;
    this.notify();
  }

  /** Configure selection/interactivity for the current tool. */
  applyToCanvas(fc) {
    const t = this.tool;
    const selecting = t === 'select';
    fc.selection = selecting;
    fc.skipTargetFind = !(selecting || t === 'text' || t === 'lasso');
    fc.defaultCursor = { select: 'default', text: 'text', hand: 'grab' }[t] || 'crosshair';
    fc.hoverCursor = selecting ? 'move' : fc.defaultCursor;
    fc.forEachObject((o) => {
      const interactive = selecting || (t === 'text' && o.type === 'textbox');
      o.selectable = interactive;
      o.evented = interactive;
    });
    fc.clearContext(fc.contextTop);
    fc.requestRenderAll();
  }

  /** Attach pointer handlers once per canvas instance. */
  wire(v) {
    const fc = v.fc;
    if (fc.__wired) return;
    fc.__wired = true;
    fc.on('mouse:down', (o) => this.down(fc, o));
    fc.on('mouse:move', (o) => this.move(fc, o));
    fc.on('mouse:up', (o) => this.up(fc, o));
    fc.on('mouse:out', () => { if (this.tool === 'eraser') fc.clearContext(fc.contextTop); });
    fc.on('mouse:dblclick', (o) => this.ed.emit('dblclick', fc, o.target));
    fc.on('object:moving', (e) => this.snap(fc, e));
    fc.on('object:scaling', (e) => this.trackTransform(fc, e, 'scale'));
    fc.on('object:rotating', (e) => this.trackTransform(fc, e, 'rotate'));
    fc.on('before:render', () => { if (fc.__guides) fc.clearContext(fc.contextTop); });
    fc.on('after:render', () => this.drawGuides(fc));
    fc.on('mouse:up', () => {
      if (fc.__guides) { fc.__guides = null; fc.clearContext(fc.contextTop); fc.requestRenderAll(); }
    });
  }

  pointer(fc, e) {
    const p = fc.getPointer(e);
    return { x: p.x, y: p.y };
  }

  // ---------- pointer routing ----------

  down(fc, o) {
    const e = o.e;
    if (e.button === 1 || this.spaceDown || this.tool === 'hand') return; // panning handled by app
    // Stylus hardware: the eraser end always erases, the barrel button lassoes.
    if (e.pointerType === 'pen' && (e.buttons & 32 || e.button === 5)) { this.hardwareEraser = true; return this.eraseDown(fc, e); }
    if (e.pointerType === 'pen' && e.buttons & 2) { this.hardwareLasso = true; return this.lassoDown(fc, o); }
    if (e.button === 2) return;
    const t = this.tool;
    if (t === 'select') return this.selectDown(fc, o);
    if (INK_TOOLS.has(t)) return this.inkDown(fc, e);
    if (t === 'eraser') return this.eraseDown(fc, e);
    if (t === 'lasso') return this.lassoDown(fc, o);
    if (t === 'shape') return this.shapeDown(fc, e);
    if (t === 'text') return this.textDown(fc, o);
    if (t === 'tape') return this.shapeDown(fc, e, 'tape');
    if (t === 'laser') return this.laserDown(fc, e);
    return undefined;
  }

  move(fc, o) {
    const e = o.e;
    if (this.stroke && this.stroke.fc === fc) return this.inkMove(fc, e);
    if (this.tool === 'eraser' || (this.erasing && this.erasing.fc === fc)) return this.eraseMove(fc, e);
    if (this.lasso && this.lasso.fc === fc) return this.lassoMove(fc, e);
    if (this.drag && this.drag.fc === fc) return this.shapeMove(fc, e);
    if (this.laser && this.laser.fc === fc) return this.laserMove(fc, e);
    return undefined;
  }

  up(fc, o) {
    if (this.stroke && this.stroke.fc === fc) return this.inkUp(fc, o.e);
    if (this.erasing && this.erasing.fc === fc) return this.eraseUp(fc);
    if (this.lasso && this.lasso.fc === fc) return this.lassoUp(fc);
    if (this.drag && this.drag.fc === fc) return this.shapeUp(fc);
    if (this.laser && this.laser.fc === fc) { this.laser.down = false; return undefined; }
    if (this.tool === 'select' && o.target?.isTape && this.tapeClick) {
      const moved = Math.hypot(o.e.clientX - this.tapeClick.x, o.e.clientY - this.tapeClick.y) > 4;
      if (!moved) this.toggleTape(fc, o.target);
      this.tapeClick = null;
    }
    return undefined;
  }

  selectDown(fc, o) {
    const t = o.target;
    if (t?.isTape) this.tapeClick = { x: o.e.clientX, y: o.e.clientY };
    // Alt+drag leaves a copy behind (Canva / Figma convention).
    if (t && o.e.altKey && !t.locked && t.type !== 'activeSelection') {
      t.clone((c) => {
        c.set({ left: t.left, top: t.top });
        const idx = fc.getObjects().indexOf(t);
        fc.insertAt(c, Math.max(0, idx), false);
      }, ['id', 'assetId', 'isInk', 'inkType', 'inkPen', 'inkIsPen', 'inkPoints', 'shapeKind', 'isSticky', 'listType']);
    }
    // Ctrl+click follows links.
    if (t && (o.e.ctrlKey || o.e.metaKey) && (t.linkPage || t.linkUrl)) this.ed.emit('followLink', t);
  }

  // ---------- ink ----------

  inkDown(fc, e) {
    const pen = { ...this.cfg[this.tool], type: this.tool === 'highlighter' ? 'highlighter' : this.cfg.pen.type };
    const p = this.pointer(fc, e);
    const isPen = e.pointerType === 'pen';
    const pressure = isPen ? (e.pressure || 0.5) : 0.5;
    this.stroke = {
      fc, pen, isPen, points: [[p.x, p.y, pressure]], start: p,
      shape: null, holdTimer: null, lastMove: performance.now(), startTime: performance.now(),
    };
    this.armHold();
  }

  armHold() {
    const s = this.stroke;
    clearTimeout(s.holdTimer);
    if (!s.pen.holdToShape) return;
    s.holdTimer = setTimeout(() => {
      if (this.stroke !== s || s.shape || s.points.length < 6) return;
      const shape = ink.recognizeShape(s.points);
      if (shape) {
        s.shape = shape;
        s.points = shape.points;
        this.renderStroke();
        this.ed.emit('toast', `Snapped to ${shape.kind}`);
      }
    }, 550);
  }

  inkMove(fc, e) {
    const s = this.stroke;
    if (s.shape) return;
    const evs = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    const list = evs.length ? evs : [e];
    const straight = e.shiftKey;
    for (const ev of list) {
      const p = this.pointer(fc, ev);
      const pressure = s.isPen ? (ev.pressure || 0.5) : 0.5;
      const last = s.points[s.points.length - 1];
      if (Math.hypot(p.x - last[0], p.y - last[1]) < 0.4) continue;
      if (Math.hypot(p.x - last[0], p.y - last[1]) > 1.5) this.armHold();
      if (straight) s.points = [s.points[0], [p.x, p.y, pressure]];
      else s.points.push([p.x, p.y, pressure]);
    }
    this.renderStroke();
  }

  renderStroke() {
    const s = this.stroke;
    const { fc } = s;
    const ctx = fc.contextTop;
    fc.clearContext(ctx);
    const pts = s.points.length === 2 && s.shape?.kind !== 'line' ? densifyLine(s.points) : s.points;
    const d = ink.strokePath(pts, s.pen, { isPen: s.isPen, last: false });
    if (!d) return;
    ctx.save();
    const v = fc.viewportTransform;
    ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);
    ctx.globalAlpha = s.pen.opacity;
    ctx.fillStyle = s.pen.color;
    ctx.fill(new Path2D(d));
    ctx.restore();
  }

  inkUp(fc, e) {
    const s = this.stroke;
    clearTimeout(s.holdTimer);
    this.stroke = null;
    fc.clearContext(fc.contextTop);
    let pts = s.points;
    // A tap on study tape reveals/hides it instead of leaving a dot.
    if (pts.length < 3) {
      const tape = this.findTapeAt(fc, s.start);
      if (tape) { this.toggleTape(fc, tape); return; }
    }
    if (s.pen.type !== 'highlighter' && s.pen.scribbleErase && !s.shape && this.scribbleErase(fc, pts, s.pen)) return;
    if (s.pen.type === 'highlighter' && s.pen.snapText && fc.view.page.pdf && !s.shape) {
      this.snapHighlight(fc, pts, s.pen).then((done) => { if (!done) this.addInk(fc, s, pts); });
      return;
    }
    this.addInk(fc, s, pts);
  }

  addInk(fc, s, pts) {
    if (s.pen.type === 'highlighter' && s.pen.autoStraight && !s.shape && pts.length > 2) {
      const a = pts[0];
      const b = pts[pts.length - 1];
      const len = pts.reduce((acc, p, i) => (i ? acc + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) / (len || 1) > 0.96) pts = densifyLine([a, b]);
    }
    if (pts.length === 2) pts = densifyLine(pts);
    if (pts.length === 1) pts = [pts[0], [pts[0][0] + 0.2, pts[0][1] + 0.2, pts[0][2]]];
    const obj = ink.makeInkObject(pts, s.pen, s.isPen);
    if (!obj) return;
    obj.set({ selectable: false, evented: false, id: uid('ink') });
    if (this.ed.recorder?.active) obj.audioRef = this.ed.recorder.stamp(s.startTime);
    this.insertInk(fc, obj, s.pen.type === 'highlighter' && s.pen.behindInk);
    fc.requestRenderAll();
  }

  insertInk(fc, obj, behind) {
    if (behind) {
      // Highlighter sits under ink and text but above images and shapes on the page.
      const objs = fc.getObjects();
      let idx = 0;
      for (let i = 0; i < objs.length; i++) if (objs[i].type === 'image' || objs[i].shapeKind) idx = i + 1;
      fc.insertAt(obj, idx, false);
    } else {
      fc.add(obj);
    }
  }

  /** Scribbling back and forth over handwriting erases it (GoodNotes / Journal gesture). */
  scribbleErase(fc, pts, pen) {
    if (pts.length < 24) return false;
    let reversals = 0;
    let dir = 0;
    let anchor = pts[0][0];
    for (const p of pts) {
      const dx = p[0] - anchor;
      if (Math.abs(dx) < 6) continue;
      const d = Math.sign(dx);
      if (dir && d !== dir) reversals++;
      dir = d;
      anchor = p[0];
    }
    if (reversals < 5) return false;
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs);
    const hh = Math.max(...ys) - Math.min(...ys);
    const len = pts.reduce((acc, p, i) => (i ? acc + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
    if (len < Math.max(w, hh) * 3.2) return false;
    const r = Math.max(2, pen.size);
    const step = Math.max(1, Math.floor(pts.length / 60));
    const hits = new Set();
    for (const o of fc.getObjects()) {
      if (!o.isInk || o.locked) continue;
      for (let i = 0; i < pts.length; i += step) {
        if (ink.inkHit(o, { x: pts[i][0], y: pts[i][1] }, r)) { hits.add(o); break; }
      }
    }
    if (!hits.size) return false;
    fc.__suspendCommit = true;
    hits.forEach((o) => fc.remove(o));
    fc.__suspendCommit = false;
    fc.requestRenderAll();
    this.ed.commit(fc.view);
    this.ed.emit('toast', `Scribble erased ${hits.size} stroke${hits.size > 1 ? 's' : ''}`, true);
    return true;
  }

  /** Highlighter over PDF text snaps to the text lines it covers. */
  async snapHighlight(fc, pts, pen) {
    const page = fc.view.page;
    const asset = this.ed.assets.get(page.pdf.assetId);
    if (!asset) return false;
    const key = `${page.pdf.assetId}:${page.pdf.pageIndex}`;
    this.textCache ||= new Map();
    if (!this.textCache.has(key)) this.textCache.set(key, pdf.pdfTextItems(page.pdf.assetId, asset.bytes, page.pdf.pageIndex).catch(() => []));
    const items = await this.textCache.get(key);
    if (!items.length) return false;
    const sx = page.width / (asset.pageWidthHint || page.width);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const lines = [];
    for (const it of items) {
      const x1 = it.x * sx, y1 = it.y * sx, x2 = (it.x + it.width) * sx, y2 = (it.y + it.height) * sx;
      const overlapY = Math.min(y2, maxY + pen.size / 2) - Math.max(y1, minY - pen.size / 2);
      if (overlapY < (y2 - y1) * 0.45) continue;
      let a = Math.max(x1, minX);
      let b = Math.min(x2, maxX);
      if (b - a < 3) continue;
      // Extend to whole words, using the font's real character widths.
      const n = it.str.length;
      if (n > 1) {
        const off = pdf.charOffsets(it).map((v) => x1 + v * sx);
        let i = off.findIndex((v, k) => k < n && off[k + 1] > a + (off[k + 1] - v) * 0.35);
        let j = n - [...off].reverse().findIndex((v) => v < b - 1);
        if (i < 0) i = 0;
        j = Math.max(i + 1, Math.min(n, j));
        while (i > 0 && /\S/.test(it.str[i - 1])) i--;
        while (j < n && /\S/.test(it.str[j])) j++;
        a = off[i];
        b = off[j];
      }
      const line = lines.find((l) => Math.abs(l.y1 - y1) < (y2 - y1) * 0.5);
      if (line) { line.a = Math.min(line.a, a); line.b = Math.max(line.b, b); line.y2 = Math.max(line.y2, y2); }
      else lines.push({ a, b, y1, y2 });
    }
    if (!lines.length) return false;
    const style = pen.markStyle || 'highlight';
    fc.__suspendCommit = true;
    for (const l of lines) {
      const hgt = l.y2 - l.y1;
      let y;
      let thick;
      if (style === 'underline') { thick = Math.max(1.5, hgt * 0.09); y = l.y2 - thick * 0.6; }
      else if (style === 'strike') { thick = Math.max(1.5, hgt * 0.09); y = l.y1 + hgt * 0.5 - thick / 2; }
      else { thick = hgt * 0.92; y = l.y1 + hgt * 0.04; }
      const mid = y + thick / 2;
      const linePen = { ...pen, size: thick, thinning: 0, taperStart: 0, taperEnd: 0, smoothing: 0.2, streamline: 0 };
      const points = densifyLine([[l.a + thick / 2 * (style === 'highlight' ? 0.15 : 0), mid, 0.5], [l.b, mid, 0.5]]);
      const obj = ink.makeInkObject(points, linePen, false);
      if (!obj) continue;
      if (style !== 'highlight') obj.set({ opacity: Math.max(0.85, pen.opacity), globalCompositeOperation: 'source-over' });
      obj.set({ selectable: false, evented: false, id: uid('ink'), inkType: 'highlighter', textMark: style });
      if (this.ed.recorder?.active) obj.audioRef = this.ed.recorder.stamp(performance.now());
      this.insertInk(fc, obj, style === 'highlight' && pen.behindInk);
    }
    fc.__suspendCommit = false;
    fc.requestRenderAll();
    this.ed.commit(fc.view);
    return true;
  }

  // ---------- eraser ----------

  eraseDown(fc, e) {
    this.erasing = { fc, changed: false };
    fc.__suspendCommit = true;
    this.eraseAt(fc, e);
  }

  eraseMove(fc, e) {
    const p = this.pointer(fc, e);
    const ctx = fc.contextTop;
    fc.clearContext(ctx);
    const r = this.cfg.eraser.size / 2;
    ctx.save();
    const v = fc.viewportTransform;
    ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
    ctx.lineWidth = 1 / fc.getZoom();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.stroke();
    ctx.restore();
    if (this.erasing) {
      const evs = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      (evs.length ? evs : [e]).forEach((ev) => this.eraseAt(fc, ev));
    }
  }

  eraseAt(fc, e) {
    const p = this.pointer(fc, e);
    const { size, mode, filter } = this.cfg.eraser;
    const r = size / 2;
    const targets = fc.getObjects().filter((o) => {
      if (!o.isInk || o.locked) return false;
      if (filter === 'pen' && o.inkType === 'highlighter') return false;
      if (filter === 'highlighter' && o.inkType !== 'highlighter') return false;
      return ink.inkHit(o, p, r);
    });
    for (const o of targets) {
      if (mode === 'stroke') {
        fc.remove(o);
        this.erasing.changed = true;
      } else {
        const pieces = ink.splitInk(o, p, r);
        if (!pieces) continue;
        const idx = fc.getObjects().indexOf(o);
        fc.remove(o);
        pieces.forEach((n, k) => {
          n.set({ selectable: false, evented: false, id: uid('ink'), audioRef: o.audioRef });
          fc.insertAt(n, idx + k, false);
        });
        this.erasing.changed = true;
      }
    }
    if (targets.length) fc.requestRenderAll();
  }

  eraseUp(fc) {
    const changed = this.erasing.changed;
    this.erasing = null;
    fc.__suspendCommit = false;
    if (changed) this.ed.commit(fc.view);
    if (this.hardwareEraser) { this.hardwareEraser = false; fc.clearContext(fc.contextTop); return; }
    if (this.cfg.eraser.autoDeselect && this.prevTool && this.prevTool !== 'eraser') this.setTool(this.prevTool);
  }

  // ---------- lasso ----------

  lassoDown(fc, o) {
    const active = fc.getActiveObject();
    if (active && o.target === active) return; // dragging the current lasso selection
    fc.discardActiveObject();
    const p = this.pointer(fc, o.e);
    this.lasso = { fc, pts: [p] };
  }

  lassoMove(fc, e) {
    const p = this.pointer(fc, e);
    this.lasso.pts.push(p);
    const ctx = fc.contextTop;
    fc.clearContext(ctx);
    ctx.save();
    const v = fc.viewportTransform;
    ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);
    ctx.beginPath();
    this.lasso.pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    ctx.fillStyle = 'rgba(15,108,189,0.06)';
    ctx.fill();
    ctx.setLineDash([4 / fc.getZoom(), 4 / fc.getZoom()]);
    ctx.lineWidth = 1.2 / fc.getZoom();
    ctx.strokeStyle = '#0f6cbd';
    ctx.stroke();
    ctx.restore();
  }

  lassoUp(fc) {
    const poly = this.lasso.pts;
    this.lasso = null;
    this.hardwareLasso = false;
    fc.clearContext(fc.contextTop);
    if (poly.length < 4) return;
    const filter = this.cfg.lasso.filter;
    const hits = fc.getObjects().filter((o) => {
      if (o.locked) return false;
      if (filter === 'ink' && !o.isInk) return false;
      if (filter === 'text' && o.type !== 'textbox') return false;
      if (filter === 'images' && o.type !== 'image') return false;
      if (filter === 'shapes' && !o.shapeKind) return false;
      const pts = ink.samplePoints(o);
      const inside = pts.filter((q) => ink.pointInPolygon(q, poly)).length;
      return inside / pts.length >= 0.6;
    });
    if (!hits.length) { fc.requestRenderAll(); return; }
    hits.forEach((h) => { h.selectable = true; });
    const sel = hits.length === 1 ? hits[0] : new fabric.ActiveSelection(hits, { canvas: fc });
    this.ed.decorate(sel);
    sel.set({ borderDashArray: [5, 4] });
    fc.setActiveObject(sel);
    fc.requestRenderAll();
  }

  // ---------- shapes & tape ----------

  shapeDown(fc, e, kind) {
    const p = this.pointer(fc, e);
    const k = kind || this.cfg.shape.kind;
    const obj = buildShape(k, this.cfg, p, 1, 1);
    obj.set({ excludeFromExport: true, selectable: false, evented: false });
    fc.__suspendCommit = true;
    fc.add(obj);
    this.drag = { fc, obj, kind: k, start: p, moved: false };
  }

  shapeMove(fc, e) {
    const d = this.drag;
    const p = this.pointer(fc, e);
    let w = p.x - d.start.x;
    let h = p.y - d.start.y;
    if (Math.abs(w) + Math.abs(h) > 3) d.moved = true;
    if (e.shiftKey && d.kind !== 'line' && d.kind !== 'arrow') {
      const m = Math.max(Math.abs(w), Math.abs(h));
      w = Math.sign(w || 1) * m;
      h = Math.sign(h || 1) * m;
    }
    fc.remove(d.obj);
    d.obj = buildShape(d.kind, this.cfg, d.start, w, h, e.shiftKey);
    d.obj.set({ excludeFromExport: true, selectable: false, evented: false });
    fc.add(d.obj);
    fc.requestRenderAll();
  }

  shapeUp(fc) {
    const d = this.drag;
    this.drag = null;
    fc.remove(d.obj);
    let obj = d.obj;
    if (!d.moved) {
      const size = d.kind === 'tape' ? [220, 44] : [140, d.kind === 'line' || d.kind === 'arrow' ? 0 : 110];
      obj = buildShape(d.kind, this.cfg, { x: d.start.x - size[0] / 2, y: d.start.y - size[1] / 2 }, size[0], size[1]);
    }
    obj.set({ excludeFromExport: false, id: uid('sh') });
    fc.__suspendCommit = false;
    fc.add(obj);
    if (d.kind === 'tape') {
      obj.set({ selectable: false, evented: false });
      fc.requestRenderAll();
      return;
    }
    this.setTool('select');
    fc.setActiveObject(obj);
    fc.requestRenderAll();
  }

  findTapeAt(fc, p) {
    const pt = new fabric.Point(p.x, p.y);
    return fc.getObjects().slice().reverse().find((o) => o.isTape && o.containsPoint(pt, null, true));
  }

  toggleTape(fc, tape) {
    tape.tapeRevealed = !tape.tapeRevealed;
    tape.set({ opacity: tape.tapeRevealed ? 0.12 : 1 });
    fc.requestRenderAll();
    this.ed.commit(fc.view, `tape:${tape.id}`);
  }

  // ---------- text ----------

  textDown(fc, o) {
    if (o.target && o.target.type === 'textbox') return; // fabric handles editing
    const p = this.pointer(fc, o.e);
    this.ed.emit('createText', fc, p);
  }

  // ---------- laser ----------

  laserDown(fc, e) {
    if (!this.laser || this.laser.fc !== fc) this.laser = { fc, trail: [] };
    this.laser.down = true;
    this.laserMove(fc, e);
    if (!this.laser.raf) this.laserLoop();
  }

  laserMove(fc, e) {
    if (!this.laser.down) return;
    const p = this.pointer(fc, e);
    this.laser.trail.push({ ...p, t: performance.now() });
  }

  laserLoop() {
    const L = this.laser;
    if (!L) return;
    const { fc } = L;
    const now = performance.now();
    L.trail = L.trail.filter((q) => now - q.t < 650);
    const ctx = fc.contextTop;
    fc.clearContext(ctx);
    if (L.trail.length) {
      ctx.save();
      const v = fc.viewportTransform;
      ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < L.trail.length; i++) {
        const a = L.trail[i - 1];
        const b = L.trail[i];
        const life = 1 - (now - b.t) / 650;
        ctx.strokeStyle = this.cfg.laser.color;
        ctx.globalAlpha = Math.max(0, life);
        ctx.shadowColor = this.cfg.laser.color;
        ctx.shadowBlur = 8;
        ctx.lineWidth = (5 * Math.max(0.3, life)) / fc.getZoom() * fc.getZoom();
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (L.trail.length || L.down) L.raf = requestAnimationFrame(() => this.laserLoop());
    else { L.raf = null; fc.clearContext(ctx); }
  }

  // ---------- smart guides ----------

  snap(fc, e) {
    const obj = e.target;
    if (!obj || e.e?.ctrlKey) { fc.__guides = null; return; }
    const page = fc.view.page;
    const zoom = fc.getZoom();
    const thr = 6 / zoom;
    obj.setCoords();
    const br = obj.getBoundingRect(true, true);
    const xs = [br.left, br.left + br.width / 2, br.left + br.width];
    const ys = [br.top, br.top + br.height / 2, br.top + br.height];
    const vx = [{ v: 0 }, { v: page.width / 2, center: true }, { v: page.width }];
    const vy = [{ v: 0 }, { v: page.height / 2, center: true }, { v: page.height }];
    const members = new Set(obj.type === 'activeSelection' ? obj.getObjects() : [obj]);
    const others = [];
    for (const o of fc.getObjects()) {
      if (members.has(o) || o.isInk || !o.visible || o.excludeFromExport) continue;
      const r = o.getBoundingRect(true, true);
      others.push(r);
      vx.push({ v: r.left, r }, { v: r.left + r.width / 2, r }, { v: r.left + r.width, r });
      vy.push({ v: r.top, r }, { v: r.top + r.height / 2, r }, { v: r.top + r.height, r });
    }
    const best = (cands, vals) => {
      let res = null;
      for (const c of cands) {
        for (let i = 0; i < vals.length; i++) {
          const d = c.v - vals[i];
          if (Math.abs(d) <= thr && (!res || Math.abs(d) < Math.abs(res.d))) res = { d, c, i };
        }
      }
      return res;
    };
    const bx = best(vx, xs);
    const by = best(vy, ys);
    const guides = [];
    if (bx) {
      obj.set({ left: obj.left + bx.d });
      const x = bx.c.v;
      const top = bx.c.r ? Math.min(bx.c.r.top, br.top) : 0;
      const bottom = bx.c.r ? Math.max(bx.c.r.top + bx.c.r.height, br.top + br.height) : page.height;
      guides.push({ x1: x, y1: top, x2: x, y2: bottom });
    }
    if (by) {
      obj.set({ top: obj.top + by.d });
      const y = by.c.v;
      const left = by.c.r ? Math.min(by.c.r.left, br.left) : 0;
      const right = by.c.r ? Math.max(by.c.r.left + by.c.r.width, br.left + br.width) : page.width;
      guides.push({ x1: left, y1: y, x2: right, y2: y });
    }
    obj.setCoords();
    // Distance labels to the nearest neighbour above/left, like Figma's red measurements.
    const nb = obj.getBoundingRect(true, true);
    const labels = [];
    const gapAbove = others.filter((r) => r.top + r.height <= nb.top && r.left < nb.left + nb.width && r.left + r.width > nb.left)
      .sort((a, b) => b.top + b.height - (a.top + a.height))[0];
    if (gapAbove) {
      const x = nb.left + nb.width / 2;
      guides.push({ x1: x, y1: gapAbove.top + gapAbove.height, x2: x, y2: nb.top, dashed: true });
      labels.push({ x, y: (gapAbove.top + gapAbove.height + nb.top) / 2, text: Math.round(nb.top - gapAbove.top - gapAbove.height) });
    }
    fc.__guides = { lines: guides, labels };
  }

  trackTransform(fc, e, kind) {
    const o = e.target;
    const br = o.getBoundingRect(true, true);
    const text = kind === 'rotate' ? `${Math.round(((o.angle % 360) + 360) % 360)}°` : `${Math.round(o.getScaledWidth())} × ${Math.round(o.getScaledHeight())}`;
    fc.__guides = { lines: [], labels: [{ x: br.left + br.width / 2, y: br.top + br.height + 26 / fc.getZoom(), text, neutral: true }] };
  }

  drawGuides(fc) {
    const g = fc.__guides;
    if (!g) return;
    const ctx = fc.contextTop;
    const z = fc.getZoom();
    ctx.save();
    const v = fc.viewportTransform;
    ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);
    ctx.lineWidth = 1 / z;
    ctx.strokeStyle = GUIDE;
    for (const l of g.lines) {
      ctx.setLineDash(l.dashed ? [3 / z, 3 / z] : []);
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.font = `600 ${11 / z}px "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const lb of g.labels) {
      const text = String(lb.text);
      const w = ctx.measureText(text).width + 10 / z;
      const h = 17 / z;
      ctx.fillStyle = lb.neutral ? 'rgba(32,32,32,0.92)' : GUIDE;
      roundRect(ctx, lb.x - w / 2, lb.y - h / 2, w, h, 3 / z);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, lb.x, lb.y + 0.5 / z);
    }
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function densifyLine([a, b]) {
  const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4));
  const out = [];
  for (let i = 0; i <= n; i++) out.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, a[2] ?? 0.5]);
  return out;
}

const DASH = { solid: null, dashed: [10, 6], dotted: [1.5, 5] };

/** Create a shape object from a drag rectangle (x,y = start point, w/h may be negative). */
export function buildShape(kind, cfg, p, w, h, shift = false) {
  const s = cfg.shape;
  const left = Math.min(p.x, p.x + w);
  const top = Math.min(p.y, p.y + h);
  const W = Math.max(1, Math.abs(w));
  const H = Math.max(1, Math.abs(h));
  const style = {
    fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth, strokeDashArray: DASH[s.dash] || null,
    strokeUniform: true, strokeLineJoin: 'round', strokeLineCap: 'round', shapeKind: kind,
  };
  switch (kind) {
    case 'tape':
      return new fabric.Rect({
        left, top, width: W, height: Math.max(H, 8), fill: cfg.tape.color, stroke: null, rx: 2, ry: 2,
        isTape: true, tapeRevealed: false, shapeKind: undefined, strokeWidth: 0,
        shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.12)', blur: 3, offsetY: 1 }),
      });
    case 'rect':
      return new fabric.Rect({ left, top, width: W, height: H, ...style });
    case 'roundRect':
      return new fabric.Rect({ left, top, width: W, height: H, rx: Math.min(W, H) * 0.18, ry: Math.min(W, H) * 0.18, ...style });
    case 'ellipse':
      return new fabric.Ellipse({ left, top, rx: W / 2, ry: H / 2, ...style });
    case 'triangle':
      return new fabric.Triangle({ left, top, width: W, height: H, ...style });
    case 'diamond':
      return new fabric.Polygon([{ x: W / 2, y: 0 }, { x: W, y: H / 2 }, { x: W / 2, y: H }, { x: 0, y: H / 2 }], { left, top, ...style });
    case 'star': {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.42 : 1;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        pts.push({ x: W / 2 + (W / 2) * r * Math.cos(a), y: H / 2 + (H / 2) * r * Math.sin(a) });
      }
      return new fabric.Polygon(pts, { left, top, ...style });
    }
    case 'line':
    case 'arrow': {
      let x2 = p.x + w;
      let y2 = p.y + h;
      if (shift) {
        const ang = Math.round(Math.atan2(h, w) / (Math.PI / 4)) * (Math.PI / 4);
        const len = Math.hypot(w, h);
        x2 = p.x + Math.cos(ang) * len;
        y2 = p.y + Math.sin(ang) * len;
      }
      return makeLine(p.x, p.y, x2, y2, { ...style, fill: null, strokeDashArray: style.strokeDashArray }, kind === 'arrow');
    }
    default:
      return new fabric.Rect({ left, top, width: W, height: H, ...style });
  }
}

/** Line or arrow as a single path so it scales/rotates like any other object. */
export function makeLine(x1, y1, x2, y2, style, arrow) {
  const sw = style.strokeWidth || 2;
  let d = `M ${x1} ${y1} L ${x2} ${y2}`;
  if (arrow) {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const L = 10 + sw * 2.4;
    const a1 = ang + Math.PI * 0.85;
    const a2 = ang - Math.PI * 0.85;
    d += ` M ${x2 + Math.cos(a1) * L} ${y2 + Math.sin(a1) * L} L ${x2} ${y2} L ${x2 + Math.cos(a2) * L} ${y2 + Math.sin(a2) * L}`;
  }
  return new fabric.Path(d, { ...style, fill: null, objectCaching: false, arrowHead: !!arrow });
}
