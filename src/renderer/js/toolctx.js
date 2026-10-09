// Toolbar contextual cluster (swatches, sizes, presets) and tool settings flyouts.
import { h, esc, flyout, menu, colorPicker, bindRange, debounce, prompt } from './ui.js';
import { icon } from './icons.js';
import * as ink from './ink.js';
import { uid } from './doc.js';

const SHAPES = [
  ['rect', 'rect', 'Rectangle (R)'], ['roundRect', 'roundRect', 'Rounded rectangle'], ['ellipse', 'ellipse', 'Ellipse (C)'],
  ['triangle', 'triangle', 'Triangle'], ['diamond', 'diamond', 'Diamond'], ['star', 'star', 'Star'],
  ['line', 'line', 'Line (Shift snaps to 45°)'], ['arrow', 'arrow', 'Arrow'],
];

export class ToolContext {
  constructor(app) {
    this.app = app;
    this.tools = app.tools;
    this.el = document.getElementById('tool-context');
    this.persist = debounce(() => app.saveSettings({ tools: this.tools.cfg, penPresets: this.presets }), 400);
    this.presets = app.settings.penPresets || [];
    this.tools.on(() => this.render());
    document.querySelectorAll('#tools .tool[data-tool]').forEach((b) => {
      b.addEventListener('click', () => {
        const t = b.dataset.tool;
        if (this.tools.tool === t) this.openSettings(t, b);
        else this.tools.setTool(t);
      });
    });
  }

  changed() {
    this.persist();
    this.render();
  }

  render() {
    const t = this.tools.tool;
    const cfg = this.tools.cfg;
    document.querySelectorAll('#tools .tool[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
    document.querySelector('.tool[data-tool="pen"]').style.setProperty('--ink', cfg.pen.color);
    document.querySelector('.tool[data-tool="highlighter"]').style.setProperty('--ink', cfg.highlighter.color);
    const el = this.el;
    el.innerHTML = '';
    const add = (n) => { el.appendChild(n); return n; };
    if (t === 'pen' || t === 'highlighter') this.inkCluster(t, add);
    else if (t === 'eraser') this.eraserCluster(add);
    else if (t === 'lasso') this.lassoCluster(add);
    else if (t === 'shape') this.shapeCluster(add);
    else if (t === 'text') this.textCluster(add);
    else if (t === 'tape') this.swatchRow(['#7fb8ee', '#f6a6c1', '#ffd36e', '#9fd9a6', '#b9b9b9'], cfg.tape.color, (c) => { cfg.tape.color = c; this.changed(); }, add);
    else if (t === 'laser') this.swatchRow(['#e5372e', '#1d4ed8', '#15803d', '#ea580c'], cfg.laser.color, (c) => { cfg.laser.color = c; this.changed(); }, add);
    else add(h(`<span class="ctx-label">${t === 'hand' ? 'Drag to move around' : 'Alt + drag duplicates'}</span>`));
  }

  swatchRow(colors, current, onPick, add, { editable = false, tool } = {}) {
    colors.forEach((c, i) => {
      const b = add(h(`<button class="swatch${c.toLowerCase() === current.toLowerCase() ? ' on' : ''}" title="${esc(c)}${editable ? ' — click again to change' : ''}"><span style="--c:${esc(c)}"></span></button>`));
      b.addEventListener('click', () => {
        if (editable && c.toLowerCase() === current.toLowerCase()) {
          colorPicker(b, {
            value: c,
            title: 'Replace swatch',
            onPick: (nc) => {
              const cfg = this.tools.cfg[tool];
              cfg.swatches[i] = nc;
              cfg.color = nc;
              this.changed();
            },
          });
          return;
        }
        onPick(c);
      });
    });
  }

  inkCluster(t, add) {
    const cfg = this.tools.cfg[t];
    // Saved pen presets for this tool.
    const presets = this.presets.filter((p) => p.tool === t);
    for (const p of presets) {
      const on = p.color === cfg.color && Math.abs(p.size - cfg.size) < 0.01 && (t === 'highlighter' || p.type === cfg.type);
      const b = add(h(`<button class="chip${on ? ' on' : ''}" title="${esc(p.name)} — right-click to rename or delete"><svg width="22" height="12" viewBox="0 0 22 12"><path d="M2 8c4-6 7 2 10-2s5-3 8-2" fill="none" stroke="${esc(p.color)}" stroke-width="${Math.min(6, Math.max(1.4, p.size / (t === 'highlighter' ? 4 : 1.2)))}" stroke-linecap="round" opacity="${p.opacity}"/></svg></button>`));
      b.addEventListener('click', () => {
        const { name, id, tool, ...rest } = p;
        Object.assign(cfg, rest);
        this.changed();
      });
      b.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        menu([
          { label: 'Rename…', action: async () => { const n = await prompt('Rename preset', p.name); if (n) { p.name = n; this.changed(); } } },
          { label: 'Update to current pen', action: () => { const { swatches, sizes, ...cur } = cfg; Object.assign(p, cur); this.changed(); } },
          { label: 'Delete', danger: true, action: () => { this.presets = this.presets.filter((x) => x !== p); this.changed(); } },
        ], { x: e.clientX, y: e.clientY });
      });
    }
    const save = add(h(`<button class="ibtn" title="Save current pen as a preset">${icon('plus', 16)}</button>`));
    save.addEventListener('click', () => {
      const { swatches, sizes, ...cur } = cfg;
      this.presets.push({ id: uid('pp'), tool: t, name: `${t === 'highlighter' ? 'Highlighter' : ink.PEN_TYPES[cfg.type]?.label || 'Pen'} ${cfg.size}`, ...cur });
      this.changed();
    });
    add(h('<span class="sep"></span>'));
    this.swatchRow(cfg.swatches, cfg.color, (c) => { cfg.color = c; this.changed(); }, add, { editable: true, tool: t });
    add(h('<span class="sep"></span>'));
    cfg.sizes.forEach((sz, i) => {
      const d = [4, 7, 10][i];
      const b = add(h(`<button class="sizedot${Math.abs(sz - cfg.size) < 0.01 ? ' on' : ''}" title="Thickness ${sz}"><span style="width:${d}px;height:${d}px"></span></button>`));
      b.addEventListener('click', () => { cfg.size = sz; this.changed(); });
    });
    const more = add(h(`<button class="ibtn" title="${t === 'pen' ? 'Pen' : 'Highlighter'} settings">${icon('sliders', 18)}</button>`));
    more.addEventListener('click', () => this.openSettings(t, more));
  }

  eraserCluster(add) {
    const cfg = this.tools.cfg.eraser;
    const seg = add(h(`<div class="seg"><button data-m="stroke" title="Erase whole strokes">Stroke</button><button data-m="partial" title="Erase only the part under the eraser">Partial</button></div>`));
    seg.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('on', b.dataset.m === cfg.mode);
      b.addEventListener('click', () => { cfg.mode = b.dataset.m; this.changed(); });
    });
    add(h('<span class="sep"></span>'));
    [8, 14, 32].forEach((sz, i) => {
      const d = [4, 7, 10][i];
      const b = add(h(`<button class="sizedot${cfg.size === sz ? ' on' : ''}" title="Eraser size ${sz}"><span style="width:${d}px;height:${d}px"></span></button>`));
      b.addEventListener('click', () => { cfg.size = sz; this.changed(); });
    });
    add(h('<span class="sep"></span>'));
    const label = { all: 'Everything', pen: 'Pen only', highlighter: 'Highlighter only' }[cfg.filter];
    const f = add(h(`<button class="chip" title="What the eraser removes">${esc(label)}${icon('chevronDown', 14)}</button>`));
    f.addEventListener('click', () => menu([
      { label: 'Everything', checked: cfg.filter === 'all', action: () => { cfg.filter = 'all'; this.changed(); } },
      { label: 'Pen only', checked: cfg.filter === 'pen', action: () => { cfg.filter = 'pen'; this.changed(); } },
      { label: 'Highlighter only', checked: cfg.filter === 'highlighter', action: () => { cfg.filter = 'highlighter'; this.changed(); } },
      '-',
      { label: 'Return to previous tool after erasing', checked: cfg.autoDeselect, action: () => { cfg.autoDeselect = !cfg.autoDeselect; this.changed(); } },
    ], f));
  }

  lassoCluster(add) {
    const cfg = this.tools.cfg.lasso;
    add(h('<span class="ctx-label">Select</span>'));
    const seg = add(h(`<div class="seg"><button data-f="all">Everything</button><button data-f="ink">Handwriting</button><button data-f="text">Text</button><button data-f="images">Images</button><button data-f="shapes">Shapes</button></div>`));
    seg.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('on', b.dataset.f === cfg.filter);
      b.addEventListener('click', () => { cfg.filter = b.dataset.f; this.changed(); });
    });
  }

  shapeCluster(add) {
    const cfg = this.tools.cfg.shape;
    for (const [kind, ic, title] of SHAPES) {
      const b = add(h(`<button class="ibtn${cfg.kind === kind ? ' on' : ''}" title="${esc(title)}">${icon(ic, 18)}</button>`));
      if (cfg.kind === kind) b.style.background = 'var(--accent-subtle)';
      b.addEventListener('click', () => { cfg.kind = kind; this.changed(); });
    }
    add(h('<span class="sep"></span>'));
    const fill = add(h(`<button class="fill-btn" title="Fill"><span style="--c:${esc(cfg.fill)}"></span></button>`));
    fill.addEventListener('click', () => colorPicker(fill, { value: cfg.fill, allowNone: true, title: 'Fill', onPick: (c) => { cfg.fill = c === 'transparent' ? '#ffffff00' : c; this.changed(); } }));
    const stroke = add(h(`<button class="fill-btn stroke" title="Outline"><span style="--c:${esc(cfg.stroke)}"></span></button>`));
    stroke.addEventListener('click', () => colorPicker(stroke, { value: cfg.stroke, title: 'Outline', onPick: (c) => { cfg.stroke = c; this.changed(); } }));
    [1.5, 2.5, 5].forEach((sz, i) => {
      const d = [4, 7, 10][i];
      const b = add(h(`<button class="sizedot${cfg.strokeWidth === sz ? ' on' : ''}" title="Outline ${sz}"><span style="width:${d}px;height:${d}px"></span></button>`));
      b.addEventListener('click', () => { cfg.strokeWidth = sz; this.changed(); });
    });
  }

  textCluster(add) {
    add(h('<span class="ctx-label">Click the page, or drag:</span>'));
    const styles = this.app.textStyles.all().filter((s) => ['heading', 'subheading', 'body'].includes(s.id) || !s.builtin);
    for (const st of styles.slice(0, 7)) {
      const label = { heading: 'Add a heading', subheading: 'Add a subheading', body: 'Add body text' }[st.id] || st.name;
      const b = add(h(`<button class="chip" draggable="true" title="Click to add, or drag onto a page" style="font-family:'${esc(st.fontFamily || 'Segoe UI')}', var(--font-ui);font-weight:${st.fontWeight === 'bold' ? 700 : st.fontWeight || 400}">${esc(label)}</button>`));
      b.addEventListener('click', () => this.app.actions.insertText({ text: st.builtin ? label.replace(/^Add (a |)/, '').replace(/^./, (m) => m.toUpperCase()) : st.name, style: st, selectAll: true }));
      b.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/x-inknote-text', JSON.stringify({ styleId: st.id, text: st.builtin ? label.replace(/^Add (a |)/, '').replace(/^./, (m) => m.toUpperCase()) : st.name }));
        e.dataTransfer.effectAllowed = 'copy';
      });
    }
    const m = add(h(`<button class="ibtn" title="Text styles">${icon('style', 18)}</button>`));
    m.addEventListener('click', () => this.app.panels.open('styles'));
  }

  // ---------- settings flyouts ----------
  openSettings(t, anchor) {
    if (t === 'pen' || t === 'highlighter') this.penSettings(t, anchor);
    else if (t === 'eraser') this.eraserSettings(anchor);
  }

  penSettings(t, anchor) {
    const cfg = this.tools.cfg[t];
    const isHL = t === 'highlighter';
    const typeSeg = isHL ? '' : `<div class="field"><div class="seg full">${Object.entries(ink.PEN_TYPES).filter(([k]) => k !== 'highlighter').map(([k, v]) => `<button data-type="${k}">${esc(v.label.replace(' pen', ''))}</button>`).join('')}</div></div>`;
    const el = h(`<div class="panel" style="width:320px">
      <div class="fly-title">${isHL ? 'Highlighter' : 'Pen'} settings</div>
      <canvas class="pen-preview" width="592" height="112"></canvas>
      ${typeSeg}
      <div class="field"><label>Thickness <span data-v="size"></span></label><input type="range" data-k="size" min="0.5" max="${isHL ? 48 : 24}" step="0.1"></div>
      <div class="field"><label>Opacity <span data-v="opacity"></span></label><input type="range" data-k="opacity" min="0.05" max="1" step="0.01"></div>
      ${isHL ? '' : '<div class="field"><label>Pressure sensitivity <span data-v="thinning"></span></label><input type="range" data-k="thinning" min="0" max="0.95" step="0.01"></div>'}
      <div class="field"><label>Smoothing <span data-v="smoothing"></span></label><input type="range" data-k="smoothing" min="0" max="1" step="0.01"></div>
      <div class="field"><label>Stabilizer (reduces hand shake) <span data-v="streamline"></span></label><input type="range" data-k="streamline" min="0" max="0.95" step="0.01"></div>
      ${isHL ? '' : '<div class="field"><label>Taper start / end</label><div class="field-row"><input type="range" data-k="taperStart" min="0" max="80" step="1"><input type="range" data-k="taperEnd" min="0" max="80" step="1"></div></div>'}
      ${isHL ? `<label class="toggle">Draw behind handwriting<input type="checkbox" data-t="behindInk"></label>
        <label class="toggle">Straighten nearly straight strokes<input type="checkbox" data-t="autoStraight"></label>
        <label class="toggle">Snap to PDF text<input type="checkbox" data-t="snapText"></label>
        <div class="field" style="margin-top:6px"><div class="seg full"><button data-mark="highlight">Highlight</button><button data-mark="underline">Underline</button><button data-mark="strike">Strike</button></div></div>`
    : '<label class="toggle">Simulate pressure with mouse speed<input type="checkbox" data-t="simulatePressure"></label>'}
      <label class="toggle">Hold at the end to snap to a shape<input type="checkbox" data-t="holdToShape"></label>
      <div class="field" style="margin-top:8px"><div class="field-label">Colour</div><div class="field-row"><button class="fill-btn colorbtn" title="Pick colour"><span></span></button><span class="muted">Click a toolbar swatch twice to replace it</span></div></div>
      <button class="btn small subtle reset" style="margin-top:4px">Reset to ${isHL ? 'highlighter' : 'pen type'} defaults</button>
    </div>`);
    const preview = el.querySelector('canvas');
    const drawPreview = () => {
      const ctx = preview.getContext('2d');
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.clearRect(0, 0, 296, 56);
      const pts = [];
      for (let i = 0; i <= 60; i++) {
        const x = 18 + i * 4.3;
        pts.push([x, 28 + Math.sin(i / 6) * 12, 0.25 + 0.7 * Math.sin((i / 60) * Math.PI)]);
      }
      const d = ink.strokePath(pts, { ...cfg, simulatePressure: false }, { isPen: true });
      ctx.globalAlpha = cfg.opacity;
      ctx.fillStyle = cfg.color;
      ctx.fill(new Path2D(d));
      ctx.globalAlpha = 1;
    };
    const sync = () => {
      el.querySelectorAll('[data-type]').forEach((b) => b.classList.toggle('on', b.dataset.type === cfg.type));
      el.querySelectorAll('[data-mark]').forEach((b) => b.classList.toggle('on', b.dataset.mark === (cfg.markStyle || 'highlight')));
      el.querySelectorAll('input[type=range]').forEach((r) => {
        r.value = cfg[r.dataset.k] ?? 0;
        r.dispatchEvent(new Event('paint'));
        const lab = el.querySelector(`[data-v="${r.dataset.k}"]`);
        if (lab) lab.textContent = r.dataset.k === 'opacity' ? `${Math.round(cfg.opacity * 100)}%` : r.dataset.k === 'size' ? cfg.size.toFixed(1) : `${Math.round((cfg[r.dataset.k] || 0) * 100)}`;
      });
      el.querySelectorAll('input[type=checkbox]').forEach((c) => { c.checked = !!cfg[c.dataset.t]; });
      el.querySelector('.colorbtn span').style.setProperty('--c', cfg.color);
      drawPreview();
    };
    el.querySelectorAll('input[type=range]').forEach((r) => {
      const paint = bindRange(r, (v) => { cfg[r.dataset.k] = v; sync(); this.changed(); });
      r.addEventListener('paint', paint);
    });
    el.querySelectorAll('input[type=checkbox]').forEach((c) => c.addEventListener('change', () => { cfg[c.dataset.t] = c.checked; this.changed(); }));
    el.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => {
      const p = ink.PEN_TYPES[b.dataset.type];
      Object.assign(cfg, { type: b.dataset.type, thinning: p.thinning, smoothing: p.smoothing, streamline: p.streamline, taperStart: p.taperStart, taperEnd: p.taperEnd, opacity: p.opacity });
      sync();
      this.changed();
    }));
    el.querySelectorAll('[data-mark]').forEach((b) => b.addEventListener('click', () => { cfg.markStyle = b.dataset.mark; sync(); this.changed(); }));
    el.querySelector('.colorbtn').addEventListener('click', (e) => colorPicker(e.currentTarget, { value: cfg.color, onPick: (c) => { cfg.color = c; this.changed(); } }));
    el.querySelector('.reset').addEventListener('click', () => {
      const p = ink.PEN_TYPES[isHL ? 'highlighter' : cfg.type];
      Object.assign(cfg, { thinning: p.thinning, smoothing: p.smoothing, streamline: p.streamline, taperStart: p.taperStart, taperEnd: p.taperEnd, opacity: p.opacity });
      sync();
      this.changed();
    });
    flyout(el, anchor);
    sync();
  }

  eraserSettings(anchor) {
    const cfg = this.tools.cfg.eraser;
    const el = h(`<div class="panel">
      <div class="fly-title">Eraser settings</div>
      <div class="field"><div class="field-label">Mode</div><div class="seg full"><button data-m="stroke">Whole stroke</button><button data-m="partial">Partial</button></div></div>
      <div class="field"><label>Size <span class="v">${cfg.size}</span></label><input type="range" min="4" max="80" step="1" value="${cfg.size}"></div>
      <div class="field"><div class="field-label">Erase</div><div class="seg full"><button data-f="all">Everything</button><button data-f="pen">Pen</button><button data-f="highlighter">Highlighter</button></div></div>
      <label class="toggle">Return to previous tool after erasing<input type="checkbox" ${cfg.autoDeselect ? 'checked' : ''}></label>
      <p class="muted" style="margin:8px 0 0">The eraser end of a stylus always erases, whatever tool is selected.</p>
    </div>`);
    const sync = () => {
      el.querySelectorAll('[data-m]').forEach((b) => b.classList.toggle('on', b.dataset.m === cfg.mode));
      el.querySelectorAll('[data-f]').forEach((b) => b.classList.toggle('on', b.dataset.f === cfg.filter));
    };
    el.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { cfg.mode = b.dataset.m; sync(); this.changed(); }));
    el.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { cfg.filter = b.dataset.f; sync(); this.changed(); }));
    bindRange(el.querySelector('input[type=range]'), (v) => { cfg.size = v; el.querySelector('.v').textContent = v; this.changed(); });
    el.querySelector('input[type=checkbox]').addEventListener('change', (e) => { cfg.autoDeselect = e.target.checked; this.changed(); });
    sync();
    flyout(el, anchor);
  }
}
