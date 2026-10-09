// Object-level operations shared by toolbar, selection bar, menus and shortcuts.
import { PROPS } from './editor.js';
import { uid } from './doc.js';
import * as ink from './ink.js';
import { toast } from './ui.js';

const { fabric } = window;

export const CHAR_PROPS = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'underline', 'linethrough', 'fill', 'textBackgroundColor', 'stroke', 'strokeWidth'];
export const TEXT_PROPS = [...CHAR_PROPS, 'lineHeight', 'charSpacing', 'textAlign', 'shadow', 'opacity'];

export const BUILTIN_STYLES = [
  { id: 'title', name: 'Title', builtin: true, fontFamily: 'Segoe UI', fontSize: 40, fontWeight: 'bold', fill: '#1f1f1f', lineHeight: 1.1 },
  { id: 'heading', name: 'Heading', builtin: true, fontFamily: 'Segoe UI', fontSize: 28, fontWeight: 'bold', fill: '#1f1f1f', lineHeight: 1.15 },
  { id: 'subheading', name: 'Subheading', builtin: true, fontFamily: 'Segoe UI', fontSize: 20, fontWeight: 600, fill: '#424242', lineHeight: 1.2 },
  { id: 'body', name: 'Body', builtin: true, fontFamily: 'Segoe UI', fontSize: 16, fontWeight: 'normal', fill: '#1f1f1f', lineHeight: 1.35 },
  { id: 'caption', name: 'Caption', builtin: true, fontFamily: 'Segoe UI', fontSize: 12, fontWeight: 'normal', fill: '#616161', lineHeight: 1.3 },
  { id: 'quote', name: 'Quote', builtin: true, fontFamily: 'Georgia', fontSize: 20, fontStyle: 'italic', fill: '#424242', lineHeight: 1.35 },
  { id: 'hand', name: 'Handwritten', builtin: true, fontFamily: 'Ink Free', fontSize: 22, fill: '#1d4ed8', lineHeight: 1.25 },
];

export class Actions {
  constructor(app) {
    this.app = app;
    this.ed = app.ed;
    this.clip = null;
    this.styleClip = null;
    this.lastDuplicateOffset = { x: 16, y: 16 };
  }

  sel() { return this.ed.selection(); }

  /** Run a canvas mutation as one history step. */
  batch(fc, fn, key) {
    fc.__suspendCommit = true;
    try { fn(); } finally { fc.__suspendCommit = false; }
    fc.requestRenderAll();
    this.ed.commit(fc.view, key);
    this.ed.emit('selection', this.ed.selection());
  }

  targetCanvas() {
    return this.sel()?.fc || this.ed.activeCanvas;
  }

  async targetView() {
    const s = this.sel();
    if (s) return s.view;
    return this.ed.ensureMounted(this.ed.activePageId);
  }

  // ---------- clipboard ----------
  copy() {
    const s = this.sel();
    if (!s) return false;
    s.object.clone((c) => {
      this.clip = { obj: c, pageId: s.view.page.id, pastes: 0 };
      navigator.clipboard.writeText(`inknote:${Date.now()}`).catch(() => {});
      this.clipStamp = null;
    }, PROPS);
    return true;
  }

  cut() {
    if (this.copy()) this.remove();
  }

  async paste(pasteEvent) {
    const items = pasteEvent?.clipboardData?.items ? [...pasteEvent.clipboardData.items] : [];
    const file = items.find((i) => i.kind === 'file' && i.type.startsWith('image/'));
    const text = pasteEvent?.clipboardData?.getData('text/plain') || '';
    if (file && !text.startsWith('inknote:')) {
      const f = file.getAsFile();
      await this.insertImageBytes(new Uint8Array(await f.arrayBuffer()), f.type);
      return;
    }
    if (this.clip && (!text || text.startsWith('inknote:'))) { await this.pasteObjects(); return; }
    if (text.trim()) { await this.insertText({ text: text.slice(0, 20000) }); return; }
    if (this.clip) await this.pasteObjects();
  }

  async pasteObjects() {
    const v = await this.targetView();
    if (!v?.fc) return;
    const fc = v.fc;
    const sameSpot = this.clip.pageId !== v.page.id;
    this.clip.pastes += 1;
    const off = sameSpot ? 0 : 16 * this.clip.pastes;
    this.clip.obj.clone((c) => {
      fc.discardActiveObject();
      this.batch(fc, () => {
        c.set({ left: c.left + off, top: c.top + off, evented: true });
        if (c.type === 'activeSelection') {
          c.canvas = fc;
          c.forEachObject((o) => { o.id = uid('ob'); fc.add(o); });
          c.setCoords();
        } else {
          c.id = uid('ob');
          fc.add(c);
        }
        this.app.tools.setTool('select');
        fc.setActiveObject(c);
      });
    }, PROPS);
  }

  duplicate() {
    const s = this.sel();
    if (!s) return;
    const { fc } = s;
    const off = this.lastDuplicateOffset;
    s.object.clone((c) => {
      fc.discardActiveObject();
      this.batch(fc, () => {
        c.set({ left: c.left + off.x, top: c.top + off.y, evented: true });
        if (c.type === 'activeSelection') {
          c.canvas = fc;
          c.forEachObject((o) => { o.id = uid('ob'); fc.add(o); });
          c.setCoords();
        } else {
          c.id = uid('ob');
          fc.add(c);
        }
        fc.setActiveObject(c);
      });
    }, PROPS);
  }

  remove() {
    const s = this.sel();
    if (!s) return;
    if (s.object.isEditing) return;
    const n = s.objects.length;
    this.batch(s.fc, () => {
      s.fc.discardActiveObject();
      s.objects.forEach((o) => s.fc.remove(o));
    });
    toast(n > 1 ? `Deleted ${n} items` : 'Deleted', { action: () => this.ed.undo() });
  }

  selectAll() {
    const fc = this.ed.activeCanvas;
    if (!fc) return;
    this.app.tools.setTool('select');
    const objs = fc.getObjects().filter((o) => !o.locked);
    if (!objs.length) return;
    fc.discardActiveObject();
    const sel = objs.length === 1 ? objs[0] : new fabric.ActiveSelection(objs, { canvas: fc });
    this.ed.decorate(sel);
    fc.setActiveObject(sel);
    fc.requestRenderAll();
  }

  nudge(dx, dy) {
    const s = this.sel();
    if (!s || s.object.locked) return;
    s.object.set({ left: s.object.left + dx, top: s.object.top + dy });
    s.object.setCoords();
    s.fc.requestRenderAll();
    this.ed.commit(s.view, `nudge:${s.object.id || 'sel'}`);
    this.ed.emit('selection', s);
  }

  // ---------- arrange ----------
  arrange(kind) {
    const s = this.sel();
    if (!s) return;
    const { fc, object: o } = s;
    const fn = { forward: 'bringForward', backward: 'sendBackwards', front: 'bringToFront', back: 'sendToBack' }[kind];
    this.batch(fc, () => fc[fn](o));
  }

  align(kind) {
    const s = this.sel();
    if (!s) return;
    const { fc, object: o, view } = s;
    const page = view.page;
    if (o.type === 'activeSelection' && s.objects.length > 1) {
      const box = o.getBoundingRect(true, true);
      fc.discardActiveObject();
      this.batch(fc, () => {
        for (const c of s.objects) alignTo(c, kind, box);
        const again = new fabric.ActiveSelection(s.objects, { canvas: fc });
        this.ed.decorate(again);
        fc.setActiveObject(again);
      });
      return;
    }
    this.batch(fc, () => alignTo(o, kind, { left: 0, top: 0, width: page.width, height: page.height }));
  }

  distribute(axis) {
    const s = this.sel();
    if (!s || s.objects.length < 3) { toast('Select three or more items to distribute'); return; }
    const { fc } = s;
    const objs = s.objects.slice();
    fc.discardActiveObject();
    this.batch(fc, () => {
      const rects = objs.map((o) => ({ o, r: o.getBoundingRect(true, true) }));
      const key = axis === 'h' ? 'left' : 'top';
      const size = axis === 'h' ? 'width' : 'height';
      rects.sort((a, b) => a.r[key] - b.r[key]);
      const start = rects[0].r[key];
      const end = rects[rects.length - 1].r[key] + rects[rects.length - 1].r[size];
      const total = rects.reduce((acc, x) => acc + x.r[size], 0);
      const gap = (end - start - total) / (rects.length - 1);
      let cur = start;
      for (const { o, r } of rects) {
        o.set(key, o[key] + (cur - r[key]));
        o.setCoords();
        cur += r[size] + gap;
      }
      const again = new fabric.ActiveSelection(objs, { canvas: fc });
      this.ed.decorate(again);
      fc.setActiveObject(again);
    });
  }

  group() {
    const s = this.sel();
    if (!s || s.object.type !== 'activeSelection') return;
    this.batch(s.fc, () => {
      const g = s.object.toGroup();
      g.id = uid('gr');
      this.ed.decorate(g);
    });
  }

  ungroup() {
    const s = this.sel();
    if (!s || s.object.type !== 'group') return;
    this.batch(s.fc, () => {
      const sel = s.object.toActiveSelection();
      sel.getObjects().forEach((o) => this.ed.decorate(o));
      this.ed.decorate(sel);
    });
  }

  toggleLock() {
    const s = this.sel();
    if (!s) return;
    const lock = !s.objects.every((o) => o.locked);
    this.batch(s.fc, () => {
      for (const o of s.objects) {
        o.locked = lock;
        o.set({ hasControls: !lock, lockMovementX: lock, lockMovementY: lock, lockScalingX: lock, lockScalingY: lock, lockRotation: lock });
      }
    });
    toast(lock ? 'Locked — it can be selected but not moved' : 'Unlocked');
  }

  flip(axis) {
    const s = this.sel();
    if (!s) return;
    this.batch(s.fc, () => {
      const prop = axis === 'h' ? 'flipX' : 'flipY';
      s.object.set(prop, !s.object[prop]);
    });
  }

  rotate90() {
    const s = this.sel();
    if (!s) return;
    this.batch(s.fc, () => {
      s.object.rotate(((s.object.angle || 0) + 90) % 360);
      s.object.setCoords();
    });
  }

  setProp(prop, value, key) {
    const s = this.sel();
    if (!s) return;
    for (const o of s.objects) o.set(prop, value);
    s.fc.requestRenderAll();
    this.ed.commit(s.view, key || `prop:${prop}`);
    this.ed.emit('selectionChanged', s);
  }

  // ---------- text ----------
  textObjects() {
    const s = this.sel();
    if (!s) return [];
    return s.objects.filter((o) => o.type === 'textbox' || o.type === 'sticky');
  }

  /** Apply a text property to the selected characters while editing, else to whole boxes. */
  setTextProp(prop, value) {
    const s = this.sel();
    if (!s) return;
    const texts = this.textObjects();
    for (const o of texts) {
      if (o.isEditing && o.selectionStart !== o.selectionEnd && CHAR_PROPS.includes(prop)) {
        o.setSelectionStyles({ [prop]: value });
      } else {
        o.set(prop, value);
        if (CHAR_PROPS.includes(prop)) o.removeStyle?.(prop);
      }
      o.initDimensions?.();
      o.setCoords();
    }
    s.fc.requestRenderAll();
    this.ed.commit(s.view, `text:${prop}`);
    this.ed.emit('selectionChanged', s);
  }

  /** Current value of a text property (respecting the character selection). */
  textValue(prop) {
    const o = this.textObjects()[0];
    if (!o) return undefined;
    if (o.isEditing && CHAR_PROPS.includes(prop)) {
      const st = o.selectionStart === o.selectionEnd
        ? o.getSelectionStyles(Math.max(0, o.selectionStart - 1), o.selectionStart)[0]
        : o.getSelectionStyles(o.selectionStart, o.selectionEnd)[0];
      if (st && st[prop] !== undefined) return st[prop];
    }
    return o[prop];
  }

  applyTextStyle(style) {
    const s = this.sel();
    if (!s) return;
    const texts = this.textObjects();
    for (const o of texts) {
      const patch = {};
      for (const k of TEXT_PROPS) if (style[k] !== undefined) patch[k] = k === 'shadow' && style[k] ? new fabric.Shadow(style[k]) : style[k];
      if (!('fontStyle' in style)) patch.fontStyle = 'normal';
      if (!('underline' in style)) patch.underline = false;
      if (!('linethrough' in style)) patch.linethrough = false;
      if (!('textBackgroundColor' in style)) patch.textBackgroundColor = '';
      if (!('stroke' in style)) { patch.stroke = null; patch.strokeWidth = 0; }
      if (!('shadow' in style)) patch.shadow = null;
      if (o.isEditing && o.selectionStart !== o.selectionEnd) {
        const charPatch = {};
        for (const k of CHAR_PROPS) if (k in patch) charPatch[k] = patch[k];
        o.setSelectionStyles(charPatch);
      } else {
        o.set(patch);
        CHAR_PROPS.forEach((k) => o.removeStyle?.(k));
        o.styleId = style.id;
      }
      o.initDimensions?.();
      o.setCoords();
    }
    s.fc.requestRenderAll();
    this.ed.commit(s.view);
    this.ed.emit('selectionChanged', s);
  }

  styleFromSelection() {
    const o = this.textObjects()[0];
    if (!o) return null;
    const st = {};
    for (const k of TEXT_PROPS) {
      const v = k === 'shadow' ? (o.shadow ? o.shadow.toObject() : undefined) : o[k];
      if (v !== undefined && v !== null && v !== '') st[k] = v;
    }
    return st;
  }

  toggleList(kind) {
    const texts = this.textObjects();
    if (!texts.length) return;
    const s = this.sel();
    for (const o of texts) {
      const lines = o.text.split('\n');
      const isBullet = lines.every((l) => /^• /.test(l));
      const isNum = lines.every((l) => /^\d+\. /.test(l));
      const strip = (l) => l.replace(/^(• |\d+\. )/, '');
      let next;
      let type = null;
      if (kind === 'bullet' && !isBullet) { next = lines.map((l) => `• ${strip(l)}`); type = 'bullet'; }
      else if (kind === 'number' && !isNum) { next = lines.map((l, i) => `${i + 1}. ${strip(l)}`); type = 'number'; }
      else next = lines.map(strip);
      if (o.isEditing) o.exitEditing();
      o.set({ text: next.join('\n'), listType: type, styles: {} });
      o.initDimensions();
    }
    s.fc.requestRenderAll();
    this.ed.commit(s.view);
    this.ed.emit('selectionChanged', s);
  }

  changeCase() {
    const texts = this.textObjects();
    if (!texts.length) return;
    const s = this.sel();
    for (const o of texts) {
      const t = o.text;
      const next = t === t.toUpperCase() ? t.toLowerCase() : t === t.toLowerCase() ? t.replace(/(^|\s)\S/g, (m) => m.toUpperCase()) : t.toUpperCase();
      o.set('text', next);
      o.initDimensions();
    }
    s.fc.requestRenderAll();
    this.ed.commit(s.view);
  }

  /** Insert a text box. opts: { text, style, at:{x,y}, view, edit } */
  async insertText({ text = '', style, at, view, edit = true, selectAll = false } = {}) {
    const v = view || await this.targetView();
    if (!v?.fc) return null;
    const fc = v.fc;
    const st = style || this.app.textStyles.defaultStyle();
    const page = v.page;
    const width = Math.min(Math.max(160, (st.fontSize || 16) * 16), page.width * 0.8);
    const vc = this.ed.visibleCenter(page.id);
    const pos = at || { x: vc.x - width / 2, y: vc.y - (st.fontSize || 16) };
    const props = {};
    for (const k of TEXT_PROPS) if (st[k] !== undefined) props[k] = k === 'shadow' && st[k] ? new fabric.Shadow(st[k]) : st[k];
    const tb = new fabric.Textbox(text, {
      left: Math.max(4, Math.min(pos.x, page.width - width - 4)),
      top: Math.max(4, Math.min(pos.y, page.height - 20)),
      width,
      ...props,
      id: uid('tx'),
    });
    this.app.tools.setTool('select');
    if (this.ed.recorder?.active) tb.audioRef = this.ed.recorder.stamp(performance.now());
    this.trackNewText(fc, tb);
    fc.add(tb);
    fc.setActiveObject(tb);
    if (edit) {
      tb.enterEditing();
      if (selectAll) tb.selectAll();
      else tb.setSelectionStart(tb.text.length);
    }
    fc.requestRenderAll();
    return tb;
  }

  /** New empty text boxes vanish if the user leaves them empty. */
  trackNewText(fc, tb) {
    tb.on('editing:exited', () => {
      if (!tb.text.trim() && tb.canvas === fc) {
        fc.remove(tb);
        fc.requestRenderAll();
      }
    });
  }

  async addSticky(at) {
    const v = await this.targetView();
    if (!v?.fc) return;
    const fc = v.fc;
    const page = v.page;
    const vc = this.ed.visibleCenter(page.id);
    const pos = at || { x: vc.x - 100, y: vc.y - 60 };
    const note = new fabric.Sticky('', {
      left: pos.x, top: pos.y, width: 200, fontSize: 16, fontFamily: 'Segoe UI', fill: '#1f1f1f',
      stickyColor: '#fff2a8', lineHeight: 1.3, id: uid('st'),
    });
    this.app.tools.setTool('select');
    fc.add(note);
    fc.setActiveObject(note);
    note.enterEditing();
    fc.requestRenderAll();
  }

  // ---------- images ----------
  async insertImageBytes(bytes, mime, { at, view } = {}) {
    const v = view || await this.targetView();
    if (!v?.fc) return null;
    const assetId = this.ed.assets.add(bytes, mime);
    const url = this.ed.assets.url(assetId);
    return new Promise((resolve) => {
      fabric.Image.fromURL(url, (img) => {
        if (!img || !img.width) { toast('That image could not be read'); resolve(null); return; }
        const page = v.page;
        const max = Math.min(page.width * 0.6, page.height * 0.6);
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        img.set({ scaleX: scale, scaleY: scale, assetId, id: uid('im') });
        const w = img.width * scale;
        const hh = img.height * scale;
        const vc = this.ed.visibleCenter(page.id);
        const c = at || vc;
        const pos = { x: Math.max(0, Math.min(page.width - w, c.x - w / 2)), y: Math.max(0, Math.min(page.height - hh, c.y - hh / 2)) };
        img.set({ left: pos.x, top: pos.y });
        this.app.tools.setTool('select');
        v.fc.add(img);
        v.fc.setActiveObject(img);
        v.fc.requestRenderAll();
        resolve(img);
      });
    });
  }

  async replaceImage(bytes, mime) {
    const s = this.sel();
    const img = s?.object;
    if (!img || img.type !== 'image') return;
    const assetId = this.ed.assets.add(bytes, mime);
    const url = this.ed.assets.url(assetId);
    const w = img.getScaledWidth();
    img.setSrc(url, () => {
      img.set({ assetId, cropX: 0, cropY: 0 });
      img.scaleToWidth(w);
      img.setCoords();
      s.fc.requestRenderAll();
      this.ed.commit(s.view);
    });
  }

  setImageFilter(name, value) {
    const s = this.sel();
    const img = s?.object;
    if (!img || img.type !== 'image') return;
    const F = fabric.Image.filters;
    const filters = (img.filters || []).filter((f) => f.type !== name);
    const make = {
      Brightness: () => (value ? new F.Brightness({ brightness: value }) : null),
      Contrast: () => (value ? new F.Contrast({ contrast: value }) : null),
      Saturation: () => (value ? new F.Saturation({ saturation: value }) : null),
      Grayscale: () => (value ? new F.Grayscale() : null),
      Sepia: () => (value ? new F.Sepia() : null),
      Blur: () => (value ? new F.Blur({ blur: value }) : null),
    }[name];
    const f = make?.();
    if (f) filters.push(f);
    img.filters = filters;
    img.applyFilters();
    s.fc.requestRenderAll();
    this.ed.commit(s.view, `filter:${name}`);
  }

  filterValue(name) {
    const img = this.sel()?.object;
    const f = img?.filters?.find((x) => x.type === name);
    if (!f) return 0;
    return { Brightness: f.brightness, Contrast: f.contrast, Saturation: f.saturation, Blur: f.blur, Grayscale: 1, Sepia: 1 }[name] ?? 0;
  }

  setCornerRadius(r) {
    const s = this.sel();
    const o = s?.object;
    if (!o) return;
    if (o.type === 'rect' && !o.isTape) {
      o.set({ rx: r, ry: r, cornerRadius: r });
    } else if (o.type === 'image') {
      o.cornerRadius = r;
      o.clipPath = r > 0 ? new fabric.Rect({
        width: o.width, height: o.height, rx: r / o.scaleX, ry: r / o.scaleY, originX: 'center', originY: 'center',
      }) : null;
      o.dirty = true;
    }
    s.fc.requestRenderAll();
    this.ed.commit(s.view, 'radius');
  }

  // ---------- ink ----------
  recolor(color) {
    const s = this.sel();
    if (!s) return;
    for (const o of s.objects) {
      if (o.isInk) { o.set('fill', color); o.inkPen = { ...o.inkPen, color }; }
      else if (o.type === 'textbox' || o.type === 'sticky') { o.set('fill', color); o.removeStyle?.('fill'); }
      else if (o.shapeKind) o.set('stroke', color);
      else if (o.type === 'group') o.getObjects().forEach((c) => (c.isInk ? c.set('fill', color) : null));
    }
    s.fc.requestRenderAll();
    this.ed.commit(s.view, 'recolor');
  }

  setInkSize(size) {
    const s = this.sel();
    if (!s) return;
    const { fc } = s;
    const inks = s.objects.filter((o) => o.isInk && o.inkPoints);
    if (!inks.length) return;
    fc.discardActiveObject();
    const replaced = [];
    this.batch(fc, () => {
      for (const o of inks) {
        const n = ink.restyleInk(o, { size });
        if (!n) continue;
        const idx = fc.getObjects().indexOf(o);
        fc.remove(o);
        fc.insertAt(n, idx, false);
        replaced.push(n);
      }
      const others = s.objects.filter((o) => !inks.includes(o));
      const all = [...replaced, ...others];
      all.forEach((o) => { o.selectable = true; o.evented = true; });
      const sel = all.length === 1 ? all[0] : new fabric.ActiveSelection(all, { canvas: fc });
      this.ed.decorate(sel);
      fc.setActiveObject(sel);
    }, 'inksize');
  }

  // ---------- style painter ----------
  copyStyle() {
    const o = this.sel()?.object;
    if (!o) return;
    const keys = o.type === 'textbox' || o.type === 'sticky' ? TEXT_PROPS
      : o.type === 'image' ? ['opacity', 'shadow', 'stroke', 'strokeWidth']
        : ['fill', 'stroke', 'strokeWidth', 'strokeDashArray', 'opacity', 'shadow'];
    this.styleClip = { kind: o.type === 'sticky' ? 'textbox' : o.type, props: Object.fromEntries(keys.map((k) => [k, o[k]])) };
    toast('Style copied — select something and choose Paste style');
  }

  pasteStyle() {
    const s = this.sel();
    if (!s || !this.styleClip) return;
    for (const o of s.objects) {
      const props = { ...this.styleClip.props };
      if (props.shadow) props.shadow = new fabric.Shadow(props.shadow);
      if ((o.type === 'textbox' || o.type === 'sticky') && this.styleClip.kind === 'textbox') {
        o.set(props);
        CHAR_PROPS.forEach((k) => o.removeStyle?.(k));
        o.initDimensions();
      } else if (!(o.type === 'textbox' || o.type === 'sticky') && this.styleClip.kind !== 'textbox') {
        o.set(props);
      }
    }
    s.fc.requestRenderAll();
    this.ed.commit(s.view);
  }

  // ---------- move between pages ----------
  async moveToPage(targetId) {
    const s = this.sel();
    if (!s || s.view.page.id === targetId) return;
    const { fc, view } = s;
    const objs = s.objects.slice();
    fc.discardActiveObject();
    const jsons = objs.map((o) => o.toObject(PROPS));
    fc.__suspendCommit = true;
    objs.forEach((o) => fc.remove(o));
    fc.__suspendCommit = false;
    const srcData = fc.toObject(PROPS);
    delete srcData.background;
    const target = this.ed.page(targetId);
    const tData = target.data ? { ...target.data, objects: [...target.data.objects] } : { version: fabric.version, objects: [] };
    for (const j of jsons) {
      j.left = Math.min(Math.max(0, j.left), Math.max(0, target.width - 40));
      j.top = Math.min(Math.max(0, j.top), Math.max(0, target.height - 40));
      tData.objects.push(j);
    }
    this.ed.setPages(this.ed.pages.map((p) => (p.id === view.page.id ? { ...p, data: srcData } : p.id === targetId ? { ...p, data: tData } : p)));
    this.ed.setActivePage(targetId, { scroll: true });
    toast(`Moved to page ${this.ed.pageIndex(targetId) + 1}`, { action: () => this.ed.undo() });
  }
}

function alignTo(o, kind, box) {
  const r = o.getBoundingRect(true, true);
  let dx = 0;
  let dy = 0;
  if (kind === 'left') dx = box.left - r.left;
  if (kind === 'centerH') dx = box.left + box.width / 2 - (r.left + r.width / 2);
  if (kind === 'right') dx = box.left + box.width - (r.left + r.width);
  if (kind === 'top') dy = box.top - r.top;
  if (kind === 'middle') dy = box.top + box.height / 2 - (r.top + r.height / 2);
  if (kind === 'bottom') dy = box.top + box.height - (r.top + r.height);
  o.set({ left: o.left + dx, top: o.top + dy });
  o.setCoords();
}
