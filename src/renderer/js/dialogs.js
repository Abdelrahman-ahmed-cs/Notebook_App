// Modal dialogs: new notebook, page setup, export, crop, signature, link, settings, shortcuts.
import { h, esc, modal, toast, bindRange } from './ui.js';
import { icon } from './icons.js';
import { PAGE_SIZES, PAPER_TEMPLATES, PAPER_COLORS, drawPaper, newPage, uid } from './doc.js';
import * as ink from './ink.js';

const { fabric } = window;

export function templateThumb(template, color = '#ffffff', w = 72, hgt = 96) {
  const c = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  c.width = w * dpr;
  c.height = hgt * dpr;
  const page = { width: 794, height: 1123, bg: { template, color, spacing: 32 } };
  drawPaper(c.getContext('2d'), page, (w * dpr) / 794);
  return c;
}

export class Dialogs {
  constructor(app) {
    this.app = app;
    this.ed = app.ed;
  }

  /** Paper picker block shared by "New notebook" and "Page setup". */
  paperPicker(state) {
    const el = h(`<div>
      <div class="field"><div class="field-label">Template</div><div class="tmpl-grid"></div></div>
      <div class="field"><div class="field-label">Paper colour</div><div class="color-row"></div></div>
      <div class="grid-2">
        <div class="field"><label>Page size</label><select class="input size">${Object.entries(PAGE_SIZES).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}<option value="keep">Keep current size</option></select></div>
        <div class="field"><label>Orientation</label><div class="seg full"><button data-o="portrait">Portrait</button><button data-o="landscape">Landscape</button></div></div>
        <div class="field"><label>Line spacing <span class="sv">${state.spacing}</span></label><input type="range" class="spacing" min="18" max="56" step="1" value="${state.spacing}"></div>
      </div></div>`);
    const grid = el.querySelector('.tmpl-grid');
    const drawGrid = () => {
      grid.innerHTML = '';
      for (const [k, label] of Object.entries(PAPER_TEMPLATES)) {
        const b = h(`<button class="tmpl${state.template === k ? ' on' : ''}"><span></span>${esc(label)}</button>`);
        b.querySelector('span').replaceWith(templateThumb(k, state.color));
        b.addEventListener('click', () => { state.template = k; drawGrid(); });
        grid.appendChild(b);
      }
    };
    drawGrid();
    const colors = el.querySelector('.color-row');
    for (const c of PAPER_COLORS) {
      const b = h(`<button style="--c:${c}" title="${c}"></button>`);
      if (c === state.color) b.classList.add('on');
      b.addEventListener('click', () => {
        state.color = c;
        colors.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        drawGrid();
      });
      colors.appendChild(b);
    }
    const sel = el.querySelector('.size');
    sel.value = state.size;
    if (!state.allowKeep) sel.querySelector('option[value=keep]').remove();
    sel.addEventListener('change', () => { state.size = sel.value; });
    el.querySelectorAll('[data-o]').forEach((b) => {
      b.classList.toggle('on', (b.dataset.o === 'landscape') === state.landscape);
      b.addEventListener('click', () => {
        state.landscape = b.dataset.o === 'landscape';
        el.querySelectorAll('[data-o]').forEach((x) => x.classList.toggle('on', x === b));
      });
    });
    bindRange(el.querySelector('.spacing'), (v) => { state.spacing = v; el.querySelector('.sv').textContent = v; });
    return el;
  }

  newNotebook(preset = {}) {
    const st = { template: 'lined', color: '#ffffff', size: 'a4', landscape: false, spacing: 32, title: 'Untitled notebook', count: 1, ...preset };
    const body = h(`<div>
      <div class="grid-2" style="margin-bottom:8px">
        <div class="field"><label>Name</label><input class="input name" autofocus value="${esc(st.title)}"></div>
        <div class="field"><label>Pages</label><input class="input count" type="number" min="1" max="500" value="${st.count}"></div>
      </div></div>`);
    body.appendChild(this.paperPicker(st));
    body.querySelector('.name').addEventListener('input', (e) => { st.title = e.target.value; });
    body.querySelector('.count').addEventListener('input', (e) => { st.count = Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 1)); });
    modal({
      title: 'New notebook',
      body,
      wide: true,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Create',
          primary: true,
          action: async () => {
            if (!(await this.app.confirmDiscard())) return false;
            const pages = Array.from({ length: st.count }, () => {
              const p = newPage({ size: st.size, landscape: st.landscape, template: st.template, color: st.color });
              p.bg.spacing = st.spacing;
              return p;
            });
            this.app.loadDocument({ title: st.title.trim() || 'Untitled notebook', pages, assets: null });
            return true;
          },
        },
      ],
    });
  }

  pageSetup(ids = [this.ed.activePageId]) {
    const first = this.ed.page(ids[0]);
    const st = { template: first.bg.template, color: first.bg.color, size: 'keep', allowKeep: true, landscape: first.width > first.height, spacing: first.bg.spacing || 32, scope: 'selected' };
    const body = h('<div></div>');
    if (first.pdf) body.appendChild(h('<p>PDF pages keep their content; the template is drawn only on pages without a PDF or image background.</p>'));
    body.appendChild(this.paperPicker(st));
    const scope = h(`<div class="field" style="margin-top:4px"><label>Apply to</label><div class="seg full"><button data-s="selected">${ids.length > 1 ? `${ids.length} selected pages` : 'This page'}</button><button data-s="all">All pages</button></div></div>`);
    scope.querySelectorAll('[data-s]').forEach((b) => {
      b.classList.toggle('on', b.dataset.s === st.scope);
      b.addEventListener('click', () => { st.scope = b.dataset.s; scope.querySelectorAll('[data-s]').forEach((x) => x.classList.toggle('on', x === b)); });
    });
    body.appendChild(scope);
    modal({
      title: 'Page setup',
      body,
      wide: true,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Apply',
          primary: true,
          action: () => {
            const target = new Set(st.scope === 'all' ? this.ed.pages.map((p) => p.id) : ids);
            this.ed.setPages(this.ed.pages.map((p) => {
              if (!target.has(p.id)) return p;
              const next = { ...p, bg: { ...p.bg, template: st.template, color: st.color, spacing: st.spacing } };
              if (!p.pdf && !p.image) {
                let w = p.width;
                let hh = p.height;
                if (st.size !== 'keep') ({ width: w, height: hh } = PAGE_SIZES[st.size]);
                if (st.landscape !== w > hh) [w, hh] = [hh, w];
                next.width = w;
                next.height = hh;
              }
              return next;
            }));
          },
        },
      ],
    });
  }

  exportPdf(ids) {
    const all = this.ed.pages.map((p) => p.id);
    const st = { range: ids && ids.length && ids.length < all.length ? 'selected' : 'all', quality: this.app.settings.exportQuality || 2, custom: '' };
    const body = h(`<div>
      <p>Imported PDF pages keep their original quality. Your notes are added on top, and typed text stays searchable.</p>
      <div class="field"><label>Pages</label><div class="seg full">
        <button data-r="all">All (${all.length})</button>
        <button data-r="current">Current page</button>
        ${ids && ids.length < all.length ? `<button data-r="selected">Selected (${ids.length})</button>` : ''}
        <button data-r="custom">Custom</button></div>
        <input class="input custom" placeholder="e.g. 1-3, 5, 8-10" hidden></div>
      <div class="field"><label>Annotation quality</label><div class="seg full">
        <button data-q="1.5">Compact</button><button data-q="2">Standard</button><button data-q="3">High</button></div></div>
      <div class="progress" hidden><div></div></div>
    </div>`);
    const custom = body.querySelector('.custom');
    const syncSeg = (attr, val) => body.querySelectorAll(`[data-${attr}]`).forEach((b) => b.classList.toggle('on', b.dataset[attr] === String(val)));
    body.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => { st.range = b.dataset.r; syncSeg('r', st.range); custom.hidden = st.range !== 'custom'; if (!custom.hidden) custom.focus(); }));
    body.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { st.quality = Number(b.dataset.q); syncSeg('q', st.quality); }));
    custom.addEventListener('keydown', (e) => e.stopPropagation());
    syncSeg('r', st.range);
    syncSeg('q', st.quality);
    modal({
      title: 'Export as PDF',
      body,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Export',
          primary: true,
          action: async () => {
            let list = all;
            if (st.range === 'current') list = [this.ed.visiblePageId || this.ed.activePageId];
            if (st.range === 'selected') list = ids;
            if (st.range === 'custom') {
              list = parseRange(custom.value, all.length).map((i) => all[i]);
              if (!list.length) { toast('Enter page numbers such as 1-3, 5'); return false; }
            }
            this.app.saveSettings({ exportQuality: st.quality });
            const bar = body.querySelector('.progress');
            bar.hidden = false;
            const ok = await this.app.exportPdf(list, st.quality, (f) => { bar.firstElementChild.style.width = `${Math.round(f * 100)}%`; });
            return ok;
          },
        },
      ],
    });
  }

  crop() {
    const s = this.ed.selection();
    const img = s?.object;
    if (!img || img.type !== 'image') return;
    const el = img.getElement();
    const fullW = el.naturalWidth || el.width;
    const fullH = el.naturalHeight || el.height;
    const crop = { x: img.cropX || 0, y: img.cropY || 0, w: img.width, h: img.height };
    const body = h(`<div><div class="crop-stage"><img alt=""><div class="crop-box"><span class="h nw" data-h="nw"></span><span class="h ne" data-h="ne"></span><span class="h sw" data-h="sw"></span><span class="h se" data-h="se"></span></div></div>
      <div class="field-row" style="margin-top:12px"><span class="muted">Aspect</span><div class="seg">
        <button data-a="free" class="on">Free</button><button data-a="1">1:1</button><button data-a="1.3333">4:3</button><button data-a="1.7778">16:9</button><button data-a="0.75">3:4</button></div>
        <button class="btn small subtle reset" style="margin-left:auto">Reset</button></div></div>`);
    const stage = body.querySelector('.crop-stage');
    const im = body.querySelector('img');
    const box = body.querySelector('.crop-box');
    im.src = el.src;
    let ratio = null;
    let scale = 1;
    let offX = 0;
    let offY = 0;
    const layout = () => {
      const sr = stage.getBoundingClientRect();
      const ir = im.getBoundingClientRect();
      scale = ir.width / fullW;
      offX = ir.left - sr.left;
      offY = ir.top - sr.top;
      box.style.left = `${offX + crop.x * scale}px`;
      box.style.top = `${offY + crop.y * scale}px`;
      box.style.width = `${crop.w * scale}px`;
      box.style.height = `${crop.h * scale}px`;
    };
    im.onload = layout;
    const clamp = () => {
      crop.w = Math.max(8, Math.min(crop.w, fullW));
      crop.h = Math.max(8, Math.min(crop.h, fullH));
      crop.x = Math.max(0, Math.min(crop.x, fullW - crop.w));
      crop.y = Math.max(0, Math.min(crop.y, fullH - crop.h));
    };
    box.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      box.setPointerCapture(e.pointerId);
      const handle = e.target.dataset.h;
      const start = { ...crop, mx: e.clientX, my: e.clientY };
      const move = (ev) => {
        const dx = (ev.clientX - start.mx) / scale;
        const dy = (ev.clientY - start.my) / scale;
        if (!handle) { crop.x = start.x + dx; crop.y = start.y + dy; }
        else {
          if (handle.includes('w')) { crop.x = Math.min(start.x + dx, start.x + start.w - 8); crop.w = start.w - (crop.x - start.x); }
          if (handle.includes('e')) crop.w = start.w + dx;
          if (handle.includes('n')) { crop.y = Math.min(start.y + dy, start.y + start.h - 8); crop.h = start.h - (crop.y - start.y); }
          if (handle.includes('s')) crop.h = start.h + dy;
          if (ratio) {
            const nh = crop.w / ratio;
            if (handle.includes('n')) crop.y += crop.h - nh;
            crop.h = nh;
          }
        }
        clamp();
        layout();
      };
      const up = () => { box.removeEventListener('pointermove', move); box.removeEventListener('pointerup', up); };
      box.addEventListener('pointermove', move);
      box.addEventListener('pointerup', up);
    });
    body.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
      body.querySelectorAll('[data-a]').forEach((x) => x.classList.toggle('on', x === b));
      ratio = b.dataset.a === 'free' ? null : Number(b.dataset.a);
      if (ratio) {
        const cx = crop.x + crop.w / 2;
        const cy = crop.y + crop.h / 2;
        crop.w = Math.min(crop.w, crop.h * ratio, fullW);
        crop.h = crop.w / ratio;
        if (crop.h > fullH) { crop.h = fullH; crop.w = crop.h * ratio; }
        crop.x = cx - crop.w / 2;
        crop.y = cy - crop.h / 2;
        clamp();
        layout();
      }
    }));
    body.querySelector('.reset').addEventListener('click', () => { Object.assign(crop, { x: 0, y: 0, w: fullW, h: fullH }); layout(); });
    modal({
      title: 'Crop image',
      body,
      wide: true,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Apply crop',
          primary: true,
          action: () => {
            // Keep the visible scale; shift so the kept region stays where it was on the page.
            const center = img.getCenterPoint();
            const oldCx = (img.cropX || 0) + img.width / 2;
            const oldCy = (img.cropY || 0) + img.height / 2;
            const newCx = crop.x + crop.w / 2;
            const newCy = crop.y + crop.h / 2;
            const local = new fabric.Point((newCx - oldCx) * img.scaleX * (img.flipX ? -1 : 1), (newCy - oldCy) * img.scaleY * (img.flipY ? -1 : 1));
            const rotated = fabric.util.rotateVector(local, fabric.util.degreesToRadians(img.angle || 0));
            img.set({ cropX: Math.round(crop.x), cropY: Math.round(crop.y), width: Math.round(crop.w), height: Math.round(crop.h) });
            img.setPositionByOrigin(new fabric.Point(center.x + rotated.x, center.y + rotated.y), 'center', 'center');
            if (img.cornerRadius) this.app.actions.setCornerRadius(img.cornerRadius);
            img.setCoords();
            s.fc.requestRenderAll();
            this.ed.commit(s.view);
          },
        },
      ],
    });
    setTimeout(layout, 60);
  }

  signature() {
    const body = h(`<div><p>Sign with your mouse, pen or finger. It is saved to Elements so you can reuse it.</p>
      <canvas class="sig-pad"></canvas>
      <div class="field-row" style="margin-top:10px"><div class="color-row"></div><button class="btn small subtle clear" style="margin-left:auto">Clear</button></div></div>`);
    const pad = body.querySelector('canvas');
    let color = '#1f1f1f';
    const strokes = [];
    let cur = null;
    const pen = { type: 'fountain', ...ink.PEN_TYPES.fountain, size: 3.2, color, opacity: 1, simulatePressure: true };
    const redraw = () => {
      const ctx = pad.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      pad.width = pad.clientWidth * dpr;
      pad.height = pad.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.moveTo(24, pad.clientHeight - 48);
      ctx.lineTo(pad.clientWidth - 24, pad.clientHeight - 48);
      ctx.stroke();
      for (const s of [...strokes, cur].filter(Boolean)) {
        ctx.fillStyle = s.color;
        ctx.fill(new Path2D(ink.strokePath(s.points, { ...pen, color: s.color }, { isPen: s.isPen })));
      }
    };
    pad.addEventListener('pointerdown', (e) => {
      pad.setPointerCapture(e.pointerId);
      cur = { color, isPen: e.pointerType === 'pen', points: [[e.offsetX, e.offsetY, e.pressure || 0.5]] };
    });
    pad.addEventListener('pointermove', (e) => {
      if (!cur) return;
      for (const ev of e.getCoalescedEvents?.() || [e]) cur.points.push([ev.offsetX, ev.offsetY, ev.pressure || 0.5]);
      redraw();
    });
    pad.addEventListener('pointerup', () => { if (cur) strokes.push(cur); cur = null; redraw(); });
    const row = body.querySelector('.color-row');
    for (const c of ['#1f1f1f', '#1d4ed8', '#0f3d8c']) {
      const b = h(`<button style="--c:${c}"></button>`);
      if (c === color) b.classList.add('on');
      b.addEventListener('click', () => { color = c; row.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); });
      row.appendChild(b);
    }
    body.querySelector('.clear').addEventListener('click', () => { strokes.length = 0; redraw(); });
    modal({
      title: 'Create signature',
      body,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Save and insert',
          primary: true,
          action: async () => {
            if (!strokes.length) { toast('Draw your signature first'); return false; }
            const objs = strokes.map((s) => ink.makeInkObject(s.points, { ...pen, color: s.color }, s.isPen)).filter(Boolean);
            const group = new fabric.Group(objs);
            await this.app.saveElementFromObjects([group], 'Signature');
            this.app.insertElement((this.app.settings.elements || []).slice(-1)[0]);
            return true;
          },
        },
      ],
    });
    setTimeout(redraw, 40);
  }

  link() {
    const s = this.ed.selection();
    if (!s) return;
    const o = s.objects[0];
    const pages = this.ed.pages;
    const body = h(`<div>
      <div class="field"><label>Link to</label><div class="seg full"><button data-k="page">A page in this notebook</button><button data-k="url">A web address</button></div></div>
      <div class="field pg"><label>Page number (1–${pages.length})</label><input class="input pnum" type="number" min="1" max="${pages.length}" value="${o.linkPage ? this.ed.pageIndex(o.linkPage) + 1 : 1}"></div>
      <div class="field url" hidden><label>Web address</label><input class="input uval" placeholder="https://" value="${esc(o.linkUrl || '')}"></div>
      <p class="muted">Ctrl+click the item to follow the link. Links also work in exported PDFs.</p></div>`);
    let kind = o.linkUrl ? 'url' : 'page';
    const sync = () => {
      body.querySelectorAll('[data-k]').forEach((b) => b.classList.toggle('on', b.dataset.k === kind));
      body.querySelector('.pg').hidden = kind !== 'page';
      body.querySelector('.url').hidden = kind !== 'url';
    };
    body.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => { kind = b.dataset.k; sync(); }));
    body.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => e.stopPropagation()));
    sync();
    const apply = (page, url) => {
      for (const x of s.objects) { x.linkPage = page; x.linkUrl = url; }
      this.ed.commit(s.view);
      this.ed.emit('selectionChanged', s);
    };
    modal({
      title: 'Link',
      body,
      actions: [
        (o.linkPage || o.linkUrl) ? { label: 'Remove link', danger: true, action: () => apply(null, null) } : { label: 'Cancel' },
        {
          label: 'Save link',
          primary: true,
          action: () => {
            if (kind === 'page') {
              const p = pages[parseInt(body.querySelector('.pnum').value, 10) - 1];
              if (!p) { toast('That page does not exist'); return false; }
              apply(p.id, null);
            } else {
              let u = body.querySelector('.uval').value.trim();
              if (!u) return false;
              if (!/^(https?:|mailto:)/i.test(u)) u = `https://${u}`;
              apply(null, u);
            }
            return true;
          },
        },
      ],
    });
  }

  settings() {
    const app = this.app;
    const s = app.settings;
    const pen = app.tools.cfg.pen;
    const body = h(`<div>
      <div class="field"><label>Theme</label><div class="seg full"><button data-t="system">System</button><button data-t="light">Light</button><button data-t="dark">Dark</button></div></div>
      <label class="toggle">Dark paper (invert pages while you work; exports are unchanged)<input type="checkbox" data-k="darkPaper" ${s.darkPaper ? 'checked' : ''}></label>
      <label class="toggle">Save automatically every minute (for notebooks already saved to a file)<input type="checkbox" data-k="autosave" ${s.autosave !== false ? 'checked' : ''}></label>
      <label class="toggle">Scribble over handwriting to erase it<input type="checkbox" data-p="scribbleErase" ${pen.scribbleErase ? 'checked' : ''}></label>
      <label class="toggle">Show the start screen when the app opens<input type="checkbox" data-k="showHome" ${s.showHome !== false ? 'checked' : ''}></label>
      <p class="muted" style="margin-top:12px">InkNote Studio works fully offline. Notebooks are saved as .inknote files — an open ZIP format containing JSON and your original PDFs and images.</p>
    </div>`);
    const theme = s.theme || 'system';
    body.querySelectorAll('[data-t]').forEach((b) => {
      b.classList.toggle('on', b.dataset.t === theme);
      b.addEventListener('click', () => {
        body.querySelectorAll('[data-t]').forEach((x) => x.classList.toggle('on', x === b));
        app.setTheme(b.dataset.t);
      });
    });
    body.querySelectorAll('[data-k]').forEach((c) => c.addEventListener('change', () => {
      app.saveSettings({ [c.dataset.k]: c.checked });
      if (c.dataset.k === 'darkPaper') document.body.classList.toggle('dark-paper', c.checked);
    }));
    body.querySelector('[data-p=scribbleErase]').addEventListener('change', (e) => { pen.scribbleErase = e.target.checked; app.toolCtx.changed(); });
    modal({ title: 'Settings', body, actions: [{ label: 'Done', primary: true }] });
  }

  shortcuts() {
    const groups = [
      ['Tools', [['Select', 'V'], ['Lasso', 'L'], ['Pen', 'P'], ['Highlighter', 'H'], ['Eraser', 'E'], ['Text', 'T'], ['Shapes', 'S'], ['Rectangle / Ellipse', 'R / C'], ['Image', 'I'], ['Sticky note', 'N'], ['Laser pointer', 'K'], ['Pan', 'Space + drag / middle mouse'], ['Straight line while drawing', 'Shift'], ['Snap stroke to shape', 'Hold at end of stroke']]],
      ['Edit', [['Undo / Redo', 'Ctrl+Z / Ctrl+Y'], ['Cut / Copy / Paste', 'Ctrl+X / C / V'], ['Duplicate', 'Ctrl+D or Alt+drag'], ['Delete', 'Del'], ['Select all on page', 'Ctrl+A'], ['Deselect', 'Esc'], ['Nudge', 'Arrows (Shift = 10)'], ['Copy / paste style', 'Ctrl+Alt+C / V']]],
      ['Arrange', [['Group / Ungroup', 'Ctrl+G / Ctrl+Shift+G'], ['Forward / Backward', 'Ctrl+] / Ctrl+['], ['To front / back', 'Ctrl+Alt+] / ['], ['Lock', 'Alt+Shift+L']]],
      ['Text', [['Bold / Italic / Underline', 'Ctrl+B / I / U'], ['Bigger / Smaller', 'Ctrl+Shift+> / <'], ['Align left / centre / right / justify', 'Ctrl+Shift+L / E / R / J'], ['Change case', 'Ctrl+Shift+K']]],
      ['View & pages', [['Zoom', 'Ctrl+wheel, Ctrl+= / Ctrl+−'], ['Actual size', 'Ctrl+0'], ['Fit page / width', 'Shift+1 / Shift+2'], ['Previous / next page', 'PgUp / PgDn'], ['New page after current', 'Ctrl+Shift+N'], ['Pages panel', 'Ctrl+\\'], ['Search', 'Ctrl+F'], ['Present', 'F5']]],
      ['File', [['New notebook', 'Ctrl+N'], ['Open', 'Ctrl+O'], ['Save / Save as', 'Ctrl+S / Ctrl+Shift+S'], ['Export PDF', 'Ctrl+Shift+E'], ['Print', 'Ctrl+P'], ['Shortcuts', 'Ctrl+/ or F1']]],
    ];
    const body = h('<div class="shortcut-table"></div>');
    for (const [g, rows] of groups) {
      body.appendChild(h(`<h3>${esc(g)}</h3>`));
      for (const [a, k] of rows) body.appendChild(h(`<div class="sc-row"><span>${esc(a)}</span><kbd>${esc(k)}</kbd></div>`));
    }
    modal({ title: 'Keyboard shortcuts', body, wide: true, actions: [{ label: 'Close', primary: true }] });
  }

  async about() {
    const info = await window.native.appInfo();
    modal({
      title: 'InkNote Studio',
      body: `<p>Version ${esc(info.version)}</p><p>An offline notebook for Windows: annotate PDFs, write by hand, and lay out pages with text, images and shapes. No account, no subscription, no cloud.</p><p class="muted">Built with Electron, Fabric.js, PDF.js, pdf-lib and perfect-freehand.</p>`,
      actions: [{ label: 'Close', primary: true }],
    });
  }
}

export function parseRange(str, total) {
  const out = new Set();
  for (const part of str.split(/[,\s]+/).filter(Boolean)) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!m) continue;
    const a = parseInt(m[1], 10);
    const b = m[2] ? parseInt(m[2], 10) : a;
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (i >= 1 && i <= total) out.add(i - 1);
  }
  return [...out].sort((x, y) => x - y);
}

export { uid };
