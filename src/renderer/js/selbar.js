// Floating contextual toolbar shown above the current selection.
import { h, esc, flyout, menu, colorPicker, closeFlyouts, bindRange, prompt, toast } from './ui.js';
import { icon } from './icons.js';
import { systemFonts } from './fonts.js';

const { fabric } = window;

const ALIGN_CYCLE = ['left', 'center', 'right', 'justify'];
const ALIGN_ICON = { left: 'textLeft', center: 'textCenter', right: 'textRight', justify: 'textJustify' };
const STICKY_COLORS = ['#fff2a8', '#ffd6a5', '#ffc6d9', '#d7c6ff', '#c3e7ff', '#c8f2c2', '#ffffff'];

export class SelectionBar {
  constructor(app) {
    this.app = app;
    this.ed = app.ed;
    this.act = app.actions;
    this.el = document.getElementById('selbar');
    this.ws = document.getElementById('workspace');
    this.hiddenForTransform = false;
    this.ed.on('selection', () => this.render());
    this.ed.on('selectionChanged', () => this.render());
    this.ed.on('textSelection', () => this.render());
    this.ed.on('transforming', () => { this.hiddenForTransform = true; this.el.hidden = true; });
    this.ed.on('transformEnd', () => { if (this.hiddenForTransform) { this.hiddenForTransform = false; this.render(); } });
    this.ed.on('viewport', () => this.place());
    this.ed.on('zoom', () => requestAnimationFrame(() => this.place()));
    // Keep keyboard focus in the text being edited when clicking bar buttons.
    this.el.addEventListener('mousedown', (e) => {
      if (!e.target.closest('input')) e.preventDefault();
    });
  }

  refocusText() {
    const o = this.ed.selection()?.object;
    if (o?.isEditing) o.hiddenTextarea?.focus();
  }

  render() {
    const s = this.ed.selection();
    if (!s || this.hiddenForTransform) { this.el.hidden = true; return; }
    const kind = classify(s);
    this.el.innerHTML = '';
    const add = (node) => { this.el.appendChild(node); return node; };
    const btn = (ic, title, fn, on = false) => {
      const b = h(`<button class="ibtn${on ? ' on' : ''}" title="${esc(title)}">${icon(ic, 18)}</button>`);
      b.addEventListener('click', (e) => { fn(e, b); this.refocusText(); });
      return add(b);
    };
    const sep = () => add(h('<span class="sep"></span>'));

    if (kind === 'text') this.textControls(s, add, btn, sep);
    else if (kind === 'image') this.imageControls(s, add, btn, sep);
    else if (kind === 'shape') this.shapeControls(s, add, btn, sep);
    else if (kind === 'ink') this.inkControls(s, add, btn, sep);
    else if (kind === 'tape') {
      add(this.colorButton(s.object.fill, 'Tape colour', (c) => this.act.setProp('fill', c)));
      btn('eye', s.object.tapeRevealed ? 'Cover again' : 'Reveal', () => this.app.tools.toggleTape(s.fc, s.object));
      sep();
    } else if (kind === 'multi' || kind === 'group') {
      if (kind === 'group') btn('ungroup', 'Ungroup (Ctrl+Shift+G)', () => this.act.ungroup());
      else btn('group', 'Group (Ctrl+G)', () => this.act.group());
      btn('alignCenterH', 'Align', (e, b) => this.alignMenu(b));
      add(this.colorButton('#1f1f1f', 'Recolour', (c) => this.act.recolor(c)));
      sep();
    }

    const refs = s.objects.filter((o) => o.audioRef);
    if (refs.length && this.app.audio?.hasRecording(refs[0].audioRef.rec)) {
      btn('play', 'Play audio from when this was written', () => this.app.audio.playFrom(refs[0].audioRef));
      sep();
    }
    if (s.objects.some((o) => o.linkPage || o.linkUrl)) {
      btn('link', 'Follow link (Ctrl+click)', () => this.app.followLink(s.objects.find((o) => o.linkPage || o.linkUrl)));
    }
    const locked = s.objects.every((o) => o.locked);
    btn(locked ? 'lock' : 'unlock', locked ? 'Unlock (Alt+Shift+L)' : 'Lock (Alt+Shift+L)', () => this.act.toggleLock(), locked);
    btn('duplicate', 'Duplicate (Ctrl+D)', () => this.act.duplicate());
    btn('trash', 'Delete (Del)', () => this.act.remove());
    btn('more', 'More', (e, b) => this.moreMenu(b, s, kind));

    this.el.hidden = false;
    this.place();
  }

  place() {
    if (this.el.hidden) return;
    const s = this.ed.selection();
    if (!s) { this.el.hidden = true; return; }
    const br = s.object.getBoundingRect(); // canvas px, includes zoom
    const cr = s.fc.upperCanvasEl.getBoundingClientRect();
    const wr = this.ws.getBoundingClientRect();
    const vp = document.getElementById('viewport').getBoundingClientRect();
    const top = cr.top + br.top;
    const bottom = top + br.height;
    // Hide while the selection is scrolled out of view.
    this.el.style.visibility = bottom < vp.top + 12 || top > vp.bottom - 12 ? 'hidden' : '';
    const w = this.el.offsetWidth;
    const hh = this.el.offsetHeight;
    let x = cr.left + br.left + br.width / 2 - w / 2 - wr.left;
    let y = cr.top + br.top - hh - 14 - wr.top;
    if (y < vp.top - wr.top + 8) y = cr.top + br.top + br.height + 34 - wr.top;
    const minX = vp.left - wr.left + 8;
    const maxX = vp.right - wr.left - w - 8;
    x = Math.max(minX, Math.min(x, maxX));
    y = Math.max(vp.top - wr.top + 8, Math.min(y, vp.bottom - wr.top - hh - 64));
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
  }

  colorButton(value, title, onPick, { allowNone = false, kind = 'fill' } = {}) {
    const b = h(`<button class="fill-btn${kind === 'stroke' ? ' stroke' : ''}" title="${esc(title)}"><span style="--c:${esc(value || 'transparent')}"></span></button>`);
    b.addEventListener('click', () => colorPicker(b, { value, onPick: (c) => { onPick(c); this.refocusText(); }, allowNone, docColors: this.app.docColors(), title }));
    return b;
  }

  // ---------- text ----------
  textControls(s, add, btn, sep) {
    const a = this.act;
    const font = a.textValue('fontFamily') || 'Segoe UI';
    const fb = add(h(`<button class="font-btn" title="Font"><span style="font-family:'${esc(font)}'">${esc(font)}</span>${icon('chevronDown', 14)}</button>`));
    fb.addEventListener('click', () => this.fontPicker(fb, font));

    const size = Math.round((a.textValue('fontSize') || 16) * 10) / 10;
    const st = add(h(`<div class="stepper" title="Font size"><button title="Smaller (Ctrl+Shift+<)">${icon('minus', 14)}</button><input value="${size}" aria-label="Font size"><button title="Larger (Ctrl+Shift+>)">${icon('plus', 14)}</button></div>`));
    const [dec, inc] = st.querySelectorAll('button');
    const inp = st.querySelector('input');
    dec.addEventListener('click', () => { a.setTextProp('fontSize', stepSize(size, -1)); this.refocusText(); });
    inc.addEventListener('click', () => { a.setTextProp('fontSize', stepSize(size, 1)); this.refocusText(); });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const v = parseFloat(inp.value); if (v > 0 && v < 1000) a.setTextProp('fontSize', v); this.refocusText(); }
      e.stopPropagation();
    });
    inp.addEventListener('focus', () => inp.select());
    inp.addEventListener('mousedown', (e) => e.stopPropagation());
    inp.addEventListener('click', (e) => {
      menu([10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 72, 96].map((n) => ({ label: String(n), checked: n === size, action: () => { a.setTextProp('fontSize', n); this.refocusText(); } })), st);
      e.stopPropagation();
    });

    const fill = a.textValue('fill') || '#1f1f1f';
    const cb = add(h(`<button class="color-a" title="Text colour"><b>A</b><i style="--c:${esc(fill)}"></i></button>`));
    cb.addEventListener('click', () => colorPicker(cb, { value: fill, title: 'Text colour', docColors: this.app.docColors(), onPick: (c) => { a.setTextProp('fill', c); this.refocusText(); } }));

    const bold = isBold(a.textValue('fontWeight'));
    btn('bold', 'Bold (Ctrl+B)', () => a.setTextProp('fontWeight', bold ? 'normal' : 'bold'), bold);
    const italic = a.textValue('fontStyle') === 'italic';
    btn('italic', 'Italic (Ctrl+I)', () => a.setTextProp('fontStyle', italic ? 'normal' : 'italic'), italic);
    const und = !!a.textValue('underline');
    btn('underline', 'Underline (Ctrl+U)', () => a.setTextProp('underline', !und), und);
    const strike = !!a.textValue('linethrough');
    btn('strike', 'Strikethrough', () => a.setTextProp('linethrough', !strike), strike);
    const align = s.object.textAlign || 'left';
    btn(ALIGN_ICON[align] || 'textLeft', 'Alignment (click to cycle)', () => a.setTextProp('textAlign', ALIGN_CYCLE[(ALIGN_CYCLE.indexOf(align) + 1) % 4]));
    const lt = s.object.listType;
    btn(lt === 'number' ? 'numbered' : 'list', 'List: none → bullets → numbers', () => {
      if (!lt) a.toggleList('bullet');
      else if (lt === 'bullet') a.toggleList('number');
      else a.toggleList('number');
    }, !!lt);
    btn('spacing', 'Spacing', (e, b) => this.spacingPanel(b));
    sep();
    const styleBtn = add(h(`<button class="chip" title="Text styles">${icon('style', 18)}<span>Styles</span>${icon('chevronDown', 14)}</button>`));
    styleBtn.addEventListener('click', () => this.stylesMenu(styleBtn));
    btn('effects', 'Effects', () => this.app.panels.open('effects'));
    if (s.object.type === 'sticky') {
      add(this.colorButton(s.object.stickyColor, 'Note colour', (c) => this.act.setProp('stickyColor', c)));
    }
    sep();
  }

  fontPicker(anchor, current) {
    const el = h(`<div class="font-list"><div class="fl-search"><input class="input" placeholder="Search fonts" autofocus></div><div class="fl-items"><div class="menu-head">Loading fonts…</div></div></div>`);
    flyout(el, anchor);
    const list = el.querySelector('.fl-items');
    const input = el.querySelector('input');
    input.addEventListener('keydown', (e) => e.stopPropagation());
    let fonts = [];
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      list.innerHTML = '';
      const recent = this.app.textStyles.recentFonts.filter((f) => !q || f.toLowerCase().includes(q));
      const doc = this.app.docFonts().filter((f) => !q || f.toLowerCase().includes(q));
      const all = fonts.filter((f) => !q || f.toLowerCase().includes(q));
      const section = (title, items) => {
        if (!items.length) return;
        list.appendChild(h(`<div class="menu-head">${esc(title)}</div>`));
        const frag = document.createDocumentFragment();
        for (const f of items) {
          const b = h(`<button class="font-item${f === current ? ' on' : ''}" style="font-family:'${esc(f)}', var(--font-ui)" title="${esc(f)}">${esc(f)}</button>`);
          b.addEventListener('click', () => {
            this.act.setTextProp('fontFamily', f);
            this.app.textStyles.useFont(f);
            closeFlyouts();
            this.refocusText();
          });
          frag.appendChild(b);
        }
        list.appendChild(frag);
      };
      if (!q) {
        section('Recently used', recent);
        section('In this notebook', doc);
      }
      section(q ? 'Results' : `All fonts (${all.length})`, all);
      if (!list.children.length) list.appendChild(h('<div class="menu-head">No fonts match</div>'));
    };
    input.addEventListener('input', draw);
    systemFonts().then((f) => { fonts = f; draw(); });
  }

  spacingPanel(anchor) {
    const a = this.act;
    const lh = a.textValue('lineHeight') || 1.16;
    const cs = a.textValue('charSpacing') || 0;
    const el = h(`<div class="panel">
      <div class="fly-title">Spacing</div>
      <div class="field"><label>Letter spacing <span class="v1">${Math.round(cs)}</span></label><input type="range" min="-100" max="800" step="10" value="${cs}"></div>
      <div class="field"><label>Line spacing <span class="v2">${lh.toFixed(2)}</span></label><input type="range" min="0.6" max="3" step="0.05" value="${lh}"></div>
    </div>`);
    const [r1, r2] = el.querySelectorAll('input');
    bindRange(r1, (v) => { el.querySelector('.v1').textContent = v; a.setTextProp('charSpacing', v); });
    bindRange(r2, (v) => { el.querySelector('.v2').textContent = v.toFixed(2); a.setTextProp('lineHeight', v); });
    flyout(el, anchor);
  }

  stylesMenu(anchor) {
    const ts = this.app.textStyles;
    const items = ts.all().map((st) => ({
      label: st.name,
      checked: this.ed.selection()?.object?.styleId === st.id,
      action: () => this.act.applyTextStyle(st),
    }));
    items.push('-', { label: 'Save current as new style…', icon: 'plus', action: () => this.app.saveTextStyleFromSelection() });
    items.push({ label: 'Manage styles…', icon: 'style', action: () => this.app.panels.open('styles') });
    menu(items, anchor);
  }

  // ---------- image ----------
  imageControls(s, add, btn, sep) {
    btn('crop', 'Crop (double-click)', () => this.app.dialogs.crop());
    btn('flipH', 'Flip horizontal', () => this.act.flip('h'));
    btn('flipV', 'Flip vertical', () => this.act.flip('v'));
    btn('rotate', 'Rotate 90°', () => this.act.rotate90());
    btn('roundRect', 'Corner radius', (e, b) => this.sliderPanel(b, 'Corner radius', 0, 200, s.object.cornerRadius || 0, 1, (v) => this.act.setCornerRadius(v)));
    btn('opacity', 'Transparency', (e, b) => this.opacityPanel(b, s));
    btn('sliders', 'Adjust colours', () => this.app.panels.open('image'));
    add(this.colorButton(s.object.stroke || 'transparent', 'Border', (c) => {
      this.act.setProp('stroke', c === 'transparent' ? null : c);
      if (c !== 'transparent' && !s.object.strokeWidth) this.act.setProp('strokeWidth', 4);
    }, { allowNone: true, kind: 'stroke' }));
    btn('image', 'Replace image', () => this.app.replaceImageDialog());
    sep();
  }

  // ---------- shapes ----------
  shapeControls(s, add, btn, sep) {
    const o = s.object;
    if (!o.arrowHead && o.shapeKind !== 'line') {
      add(this.colorButton(o.fill, 'Fill', (c) => this.act.setProp('fill', c), { allowNone: true }));
    }
    add(this.colorButton(o.stroke, 'Outline colour', (c) => this.act.setProp('stroke', c === 'transparent' ? null : c), { allowNone: true, kind: 'stroke' }));
    btn('line', 'Outline style', (e, b) => this.strokePanel(b, s));
    if (o.type === 'rect') btn('roundRect', 'Corner radius', (e, b) => this.sliderPanel(b, 'Corner radius', 0, Math.min(o.width, o.height) / 2, o.rx || 0, 1, (v) => this.act.setCornerRadius(v)));
    btn('opacity', 'Transparency', (e, b) => this.opacityPanel(b, s));
    sep();
  }

  strokePanel(anchor, s) {
    const o = s.object;
    const dash = !o.strokeDashArray ? 'solid' : o.strokeDashArray[0] < 3 ? 'dotted' : 'dashed';
    const el = h(`<div class="panel"><div class="fly-title">Outline</div>
      <div class="field"><div class="seg full"><button data-d="solid">Solid</button><button data-d="dashed">Dashed</button><button data-d="dotted">Dotted</button></div></div>
      <div class="field"><label>Thickness <span class="v">${o.strokeWidth || 0}</span></label><input type="range" min="0" max="40" step="0.5" value="${o.strokeWidth || 0}"></div></div>`);
    el.querySelectorAll('[data-d]').forEach((b) => {
      if (b.dataset.d === dash) b.classList.add('on');
      b.addEventListener('click', () => {
        el.querySelectorAll('[data-d]').forEach((x) => x.classList.toggle('on', x === b));
        this.act.setProp('strokeDashArray', { solid: null, dashed: [10, 6], dotted: [1.5, 5] }[b.dataset.d]);
        if (b.dataset.d === 'dotted') this.act.setProp('strokeLineCap', 'round');
      });
    });
    bindRange(el.querySelector('input'), (v) => { el.querySelector('.v').textContent = v; this.act.setProp('strokeWidth', v, 'strokeWidth'); });
    flyout(el, anchor);
  }

  // ---------- ink ----------
  inkControls(s, add, btn, sep) {
    const first = s.objects.find((o) => o.isInk);
    add(this.colorButton(first?.fill || '#1f1f1f', 'Ink colour', (c) => this.act.recolor(c)));
    btn('line', 'Thickness', (e, b) => this.sliderPanel(b, 'Thickness', 0.5, 40, first?.inkPen?.size || 3, 0.5, (v) => this.act.setInkSize(v)));
    btn('copy', 'Copy (Ctrl+C)', () => this.act.copy());
    sep();
    btn('image', 'Save selection as image', () => this.app.screenshotSelection());
    btn('sticky', 'Add to elements', () => this.app.saveAsElement());
    sep();
  }

  sliderPanel(anchor, title, min, max, value, step, onChange) {
    const el = h(`<div class="panel"><div class="fly-title">${esc(title)}<span class="muted v">${value}</span></div><input type="range" min="${min}" max="${max}" step="${step}" value="${value}"></div>`);
    bindRange(el.querySelector('input'), (v) => { el.querySelector('.v').textContent = v; onChange(v); });
    flyout(el, anchor);
  }

  opacityPanel(anchor, s) {
    const v = Math.round((s.object.opacity ?? 1) * 100);
    this.sliderPanel(anchor, 'Transparency', 0, 100, v, 1, (x) => this.act.setProp('opacity', x / 100, 'opacity'));
  }

  alignMenu(anchor) {
    menu([
      { head: 'Align' },
      { label: 'Left', icon: 'alignLeft', action: () => this.act.align('left') },
      { label: 'Centre', icon: 'alignCenterH', action: () => this.act.align('centerH') },
      { label: 'Right', icon: 'alignRight', action: () => this.act.align('right') },
      { label: 'Top', icon: 'alignTop', action: () => this.act.align('top') },
      { label: 'Middle', icon: 'alignMiddle', action: () => this.act.align('middle') },
      { label: 'Bottom', icon: 'alignBottom', action: () => this.act.align('bottom') },
      '-',
      { label: 'Distribute horizontally', action: () => this.act.distribute('h') },
      { label: 'Distribute vertically', action: () => this.act.distribute('v') },
    ], anchor);
  }

  moreMenu(anchor, s, kind) {
    const a = this.act;
    const isText = kind === 'text';
    const pages = this.ed.pages;
    const curIdx = this.ed.pageIndex(s.view.page.id);
    const hasLink = s.objects.some((o) => o.linkPage || o.linkUrl);
    menu([
      { label: 'Cut', icon: 'copy', key: 'Ctrl+X', action: () => a.cut() },
      { label: 'Copy', icon: 'copy', key: 'Ctrl+C', action: () => a.copy() },
      { label: 'Duplicate', icon: 'duplicate', key: 'Ctrl+D', action: () => a.duplicate() },
      '-',
      { label: 'Copy style', icon: 'paint', key: 'Ctrl+Alt+C', action: () => a.copyStyle() },
      { label: 'Paste style', key: 'Ctrl+Alt+V', disabled: !a.styleClip, action: () => a.pasteStyle() },
      isText ? { label: 'Save as text style…', icon: 'style', action: () => this.app.saveTextStyleFromSelection() } : null,
      isText ? { label: 'Right-to-left text', checked: s.object.direction === 'rtl', action: () => {
        const rtl = s.object.direction !== 'rtl';
        for (const o of this.act.textObjects()) { o.dirLocked = true; o.set({ direction: rtl ? 'rtl' : 'ltr', textAlign: rtl ? 'right' : 'left' }); o.initDimensions(); }
        s.fc.requestRenderAll();
        this.ed.commit(s.view);
        this.render();
      } } : null,
      isText ? { label: 'Change case', icon: 'caseIcon', key: 'Ctrl+Shift+K', action: () => a.changeCase() } : null,
      '-',
      { label: 'Bring forward', icon: 'forward', key: 'Ctrl+]', action: () => a.arrange('forward') },
      { label: 'Send backward', icon: 'backward', key: 'Ctrl+[', action: () => a.arrange('backward') },
      { label: 'Bring to front', key: 'Ctrl+Alt+]', action: () => a.arrange('front') },
      { label: 'Send to back', key: 'Ctrl+Alt+[', action: () => a.arrange('back') },
      { label: 'Align', icon: 'alignCenterH', submenu: () => [
        { label: 'Left', icon: 'alignLeft', action: () => a.align('left') },
        { label: 'Centre', icon: 'alignCenterH', action: () => a.align('centerH') },
        { label: 'Right', icon: 'alignRight', action: () => a.align('right') },
        { label: 'Top', icon: 'alignTop', action: () => a.align('top') },
        { label: 'Middle', icon: 'alignMiddle', action: () => a.align('middle') },
        { label: 'Bottom', icon: 'alignBottom', action: () => a.align('bottom') },
      ] },
      { label: 'Position and layers…', icon: 'layers', action: () => this.app.panels.open('position') },
      '-',
      kind === 'multi' ? { label: 'Group', icon: 'group', key: 'Ctrl+G', action: () => a.group() } : null,
      kind === 'group' ? { label: 'Ungroup', icon: 'ungroup', key: 'Ctrl+Shift+G', action: () => a.ungroup() } : null,
      { label: 'Flip horizontal', icon: 'flipH', action: () => a.flip('h') },
      { label: 'Flip vertical', icon: 'flipV', action: () => a.flip('v') },
      { label: 'Move to page', icon: 'page', submenu: () => [
        curIdx > 0 ? { label: `Previous page (${curIdx})`, action: () => a.moveToPage(pages[curIdx - 1].id) } : null,
        curIdx < pages.length - 1 ? { label: `Next page (${curIdx + 2})`, action: () => a.moveToPage(pages[curIdx + 1].id) } : null,
        { label: 'Choose page…', action: async () => {
          const n = await prompt('Move to page', String(curIdx + 1), { label: `Page number (1–${pages.length})` });
          const i = parseInt(n, 10) - 1;
          if (pages[i]) a.moveToPage(pages[i].id);
        } },
      ] },
      { label: hasLink ? 'Edit link…' : 'Add link…', icon: 'link', action: () => this.app.dialogs.link() },
      '-',
      { label: 'Save as image…', icon: 'image', action: () => this.app.screenshotSelection() },
      { label: 'Add to elements', icon: 'sticky', action: () => this.app.saveAsElement() },
      '-',
      { label: 'Delete', icon: 'trash', key: 'Del', danger: true, action: () => a.remove() },
    ], anchor);
  }
}

function classify(s) {
  const objs = s.objects;
  if (s.object.type === 'group') return 'group';
  if (objs.length === 1) {
    const o = objs[0];
    if (o.type === 'textbox' || o.type === 'sticky') return 'text';
    if (o.type === 'image') return 'image';
    if (o.isTape) return 'tape';
    if (o.isInk) return 'ink';
    if (o.shapeKind || ['rect', 'ellipse', 'triangle', 'polygon', 'path'].includes(o.type)) return 'shape';
    return 'shape';
  }
  if (objs.every((o) => o.isInk)) return 'ink';
  if (objs.every((o) => o.type === 'textbox' || o.type === 'sticky')) return 'text';
  return 'multi';
}

function isBold(w) { return w === 'bold' || Number(w) >= 600; }

function stepSize(v, dir) {
  const steps = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 120, 144];
  if (dir > 0) return steps.find((s) => s > v + 0.01) || Math.round(v * 1.2);
  return [...steps].reverse().find((s) => s < v - 0.01) || Math.max(1, Math.round(v * 0.8));
}

export { classify };
