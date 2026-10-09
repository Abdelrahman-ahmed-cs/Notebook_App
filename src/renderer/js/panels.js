// Right-hand panels: position & layers, text styles, text effects, image adjust, search,
// annotation summary and the elements (stickers / signatures) library.
import { h, esc, bindRange, colorPicker, prompt, menu, toast, debounce, confirmDialog } from './ui.js';
import { icon } from './icons.js';
import * as pdf from './pdf.js';

const { fabric } = window;

const TITLES = {
  position: 'Position', styles: 'Text styles', effects: 'Effects', image: 'Adjust image',
  search: 'Search', annotations: 'Annotations', elements: 'Elements',
};

export class Panels {
  constructor(app) {
    this.app = app;
    this.ed = app.ed;
    this.el = document.getElementById('rightpanel');
    this.current = null;
    const rerender = debounce(() => { if (this.current && this.current !== 'search' && this.current !== 'elements') this.render(); }, 60);
    this.ed.on('selection', rerender);
    this.ed.on('selectionChanged', rerender);
    this.ed.on('stylesChanged', () => { if (this.current === 'styles') this.render(); });
    this.ed.on('pageContent', () => { if (this.current === 'annotations') rerender(); });
    this.ed.on('transformEnd', () => { if (this.current === 'position') rerender(); });
  }

  open(name, { toggle = true } = {}) {
    if (this.current === name && !this.el.hidden) {
      if (toggle) this.close();
      else this.el.querySelector('input')?.focus();
      return;
    }
    this.current = name;
    this.el.hidden = false;
    document.body.classList.add('has-rightpanel');
    this.render();
  }

  close() {
    this.current = null;
    this.el.hidden = true;
    document.body.classList.remove('has-rightpanel');
  }

  render() {
    const name = this.current;
    if (!name) return;
    const keepScroll = this.el.querySelector('.rp-body')?.scrollTop || 0;
    this.el.innerHTML = '';
    const head = h(`<div class="rp-head"><h2>${esc(TITLES[name])}</h2><button class="ibtn" title="Close">${icon('close', 16)}</button></div>`);
    head.querySelector('button').addEventListener('click', () => this.close());
    const body = h('<div class="rp-body"></div>');
    this.el.append(head, body);
    this[`render_${name}`](body);
    body.scrollTop = keepScroll;
    if (name === 'search') body.querySelector('input')?.focus();
  }

  empty(body, text) {
    body.appendChild(h(`<p class="muted" style="font-size:13px;margin-top:8px">${esc(text)}</p>`));
  }

  // ---------- position ----------
  render_position(body) {
    const s = this.ed.selection();
    const a = this.app.actions;
    if (s) {
      const sec = h(`<div class="rp-section"><h3>Arrange</h3><div class="btn-grid cols-4">
        <button class="ibtn" data-a="forward" title="Forward">${icon('forward', 18)}</button>
        <button class="ibtn" data-a="backward" title="Backward">${icon('backward', 18)}</button>
        <button class="ibtn" data-a="front" title="To front">${icon('layers', 18)}</button>
        <button class="ibtn" data-a="back" title="To back">${icon('layers', 18)}</button></div></div>`);
      sec.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => a.arrange(b.dataset.a)));
      body.appendChild(sec);
      const al = h(`<div class="rp-section"><h3>${s.objects.length > 1 ? 'Align selection' : 'Align to page'}</h3><div class="btn-grid">
        ${['alignLeft:left', 'alignCenterH:centerH', 'alignRight:right', 'alignTop:top', 'alignMiddle:middle', 'alignBottom:bottom'].map((x) => {
          const [ic, k] = x.split(':');
          return `<button class="ibtn" data-al="${k}" title="${k}">${icon(ic, 18)}</button>`;
        }).join('')}</div>
        ${s.objects.length > 2 ? '<div class="field-row" style="margin-top:8px"><button class="btn small grow" data-d="h">Space evenly ↔</button><button class="btn small grow" data-d="v">Space evenly ↕</button></div>' : ''}</div>`);
      al.querySelectorAll('[data-al]').forEach((b) => b.addEventListener('click', () => a.align(b.dataset.al)));
      al.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => a.distribute(b.dataset.d)));
      body.appendChild(al);

      const o = s.object;
      const br = o.getBoundingRect(true, true);
      const geo = h(`<div class="rp-section"><h3>Size and position</h3><div class="num-grid">
        <label class="num-field"><span>X</span><input data-g="x" value="${Math.round(br.left)}"></label>
        <label class="num-field"><span>Y</span><input data-g="y" value="${Math.round(br.top)}"></label>
        <label class="num-field"><span>W</span><input data-g="w" value="${Math.round(o.getScaledWidth())}"></label>
        <label class="num-field"><span>H</span><input data-g="h" value="${Math.round(o.getScaledHeight())}"></label>
        <label class="num-field"><span>°</span><input data-g="r" value="${Math.round(o.angle || 0)}"></label>
        <label class="num-field"><span>%</span><input data-g="o" value="${Math.round((o.opacity ?? 1) * 100)}" title="Opacity"></label>
      </div></div>`);
      geo.querySelectorAll('input').forEach((inp) => {
        inp.addEventListener('keydown', (e) => e.stopPropagation());
        inp.addEventListener('change', () => {
          const v = parseFloat(inp.value);
          if (Number.isNaN(v)) return;
          const g = inp.dataset.g;
          const cur = o.getBoundingRect(true, true);
          if (g === 'x') o.set('left', o.left + (v - cur.left));
          if (g === 'y') o.set('top', o.top + (v - cur.top));
          if (g === 'w' && v > 0) o.scaleToWidth(v);
          if (g === 'h' && v > 0) o.scaleToHeight(v);
          if (g === 'r') o.rotate(v);
          if (g === 'o') o.set('opacity', Math.max(0, Math.min(100, v)) / 100);
          o.setCoords();
          s.fc.requestRenderAll();
          this.ed.commit(s.view);
          this.render();
        });
      });
      body.appendChild(geo);
    } else {
      this.empty(body, 'Select something on the page to arrange, align or size it precisely.');
    }
    // layers list for the active page
    const fc = s?.fc || this.ed.activeCanvas;
    if (!fc) return;
    const sec = h('<div class="rp-section"><h3>Layers on this page</h3><div class="layers"></div></div>');
    const list = sec.querySelector('.layers');
    const objs = fc.getObjects().slice().reverse();
    if (!objs.length) list.appendChild(h('<p class="muted">This page is empty.</p>'));
    const selected = new Set(s?.objects || []);
    for (const ob of objs) {
      const ic = ob.type === 'image' ? 'image' : ob.type === 'textbox' ? 'text' : ob.type === 'sticky' ? 'sticky' : ob.isInk ? (ob.inkType === 'highlighter' ? 'highlighter' : 'pen') : ob.isTape ? 'tape' : ob.type === 'group' ? 'group' : 'shapes';
      const label = ob.name || (ob.text ? ob.text.split('\n')[0].slice(0, 40) : null) || { image: 'Image', group: 'Group' }[ob.type] || (ob.isInk ? (ob.inkType === 'highlighter' ? 'Highlight' : 'Handwriting') : ob.isTape ? 'Tape' : ob.shapeKind || ob.type);
      const row = h(`<button class="layer-row${selected.has(ob) ? ' on' : ''}">${icon(ic, 16)}<span class="lname">${esc(label)}</span>${ob.locked ? icon('lock', 14) : ''}</button>`);
      row.addEventListener('click', () => {
        this.app.tools.setTool('select');
        fc.setActiveObject(ob);
        fc.requestRenderAll();
      });
      row.addEventListener('dblclick', async () => {
        const n = await prompt('Layer name', ob.name || label);
        if (n !== null) { ob.name = n; this.ed.commit(fc.view); this.render(); }
      });
      list.appendChild(row);
    }
    body.appendChild(sec);
  }

  // ---------- text styles ----------
  render_styles(body) {
    const ts = this.app.textStyles;
    const s = this.ed.selection();
    const hasText = !!this.app.actions.textObjects().length;
    const top = h(`<div class="rp-section"><p class="muted" style="margin:0 0 10px">Click a style to apply it to the selected text. New text boxes use the default style.</p>
      <button class="btn small" ${hasText ? '' : 'disabled'}>${icon('plus', 16)} Save selected text as a style</button></div>`);
    top.querySelector('button').addEventListener('click', () => this.app.saveTextStyleFromSelection());
    body.appendChild(top);
    const sec = h('<div class="rp-section"></div>');
    for (const st of ts.all()) {
      const isDefault = ts.defaultId === st.id;
      const row = h(`<div class="style-row" role="button" tabindex="0">
        <div style="flex:1;min-width:0">
          <div class="sample" style="font-family:'${esc(st.fontFamily || 'Segoe UI')}', var(--font-ui);font-size:${Math.min(28, Math.max(12, st.fontSize || 16))}px;font-weight:${st.fontWeight === 'bold' ? 700 : st.fontWeight || 400};font-style:${st.fontStyle || 'normal'};color:${esc(st.fill || 'inherit')}">${esc(st.name)}</div>
          <div class="meta">${esc(st.fontFamily || 'Segoe UI')} · ${st.fontSize || 16}${isDefault ? ' · default for new text' : ''}</div>
        </div>
        <button class="ibtn" title="Options">${icon('more', 16)}</button></div>`);
      row.addEventListener('click', (e) => {
        if (e.target.closest('.ibtn')) return;
        if (hasText) this.app.actions.applyTextStyle(st);
        else this.app.actions.insertText({ text: st.name, style: st, selectAll: true });
      });
      row.querySelector('.ibtn').addEventListener('click', (e) => {
        e.stopPropagation();
        menu([
          { label: 'Use for new text boxes', checked: isDefault, action: () => ts.setDefault(st.id) },
          { label: 'Update to match selection', disabled: !hasText, action: () => { ts.update(st.id, this.app.actions.styleFromSelection()); toast(`Updated “${st.name}”`); } },
          { label: 'Rename…', disabled: st.builtin, action: async () => { const n = await prompt('Rename style', st.name); if (n) ts.rename(st.id, n); } },
          '-',
          { label: 'Delete', danger: true, disabled: st.builtin, action: async () => { if (await confirmDialog('Delete style', `Delete “${st.name}”? Text already using it keeps its formatting.`, { okLabel: 'Delete', danger: true })) ts.remove(st.id); } },
        ], e.currentTarget);
      });
      sec.appendChild(row);
    }
    body.appendChild(sec);
    return s;
  }

  // ---------- text effects ----------
  render_effects(body) {
    const a = this.app.actions;
    const texts = a.textObjects();
    if (!texts.length) { this.empty(body, 'Select a text box or sticky note to add a shadow, outline or background.'); return; }
    const o = texts[0];
    const sh = o.shadow;
    const sec = (title) => body.appendChild(h(`<div class="rp-section"><h3>${esc(title)}</h3></div>`));

    const shadowSec = sec('Shadow');
    shadowSec.appendChild(h(`<label class="toggle">Drop shadow<input type="checkbox" ${sh ? 'checked' : ''}></label>`));
    const shadowCtl = h(`<div ${sh ? '' : 'hidden'}>
      <div class="field"><label>Blur <span class="v1">${sh?.blur ?? 6}</span></label><input type="range" min="0" max="40" value="${sh?.blur ?? 6}"></div>
      <div class="field"><label>Offset <span class="v2">${sh?.offsetY ?? 3}</span></label><input type="range" min="-30" max="30" value="${sh?.offsetY ?? 3}"></div>
      <div class="field-row"><span class="muted">Colour</span><button class="fill-btn sc"><span style="--c:${esc(sh?.color || 'rgba(0,0,0,0.35)')}"></span></button></div></div>`);
    shadowSec.appendChild(shadowCtl);
    const setShadow = (patch) => {
      const cur = o.shadow ? o.shadow.toObject() : { color: 'rgba(0,0,0,0.35)', blur: 6, offsetX: 2, offsetY: 3 };
      a.setTextProp('shadow', new fabric.Shadow({ ...cur, ...patch }));
    };
    shadowSec.querySelector('input[type=checkbox]').addEventListener('change', (e) => {
      shadowCtl.hidden = !e.target.checked;
      a.setTextProp('shadow', e.target.checked ? new fabric.Shadow({ color: 'rgba(0,0,0,0.35)', blur: 6, offsetX: 2, offsetY: 3 }) : null);
    });
    const [r1, r2] = shadowCtl.querySelectorAll('input[type=range]');
    bindRange(r1, (v) => { shadowCtl.querySelector('.v1').textContent = v; setShadow({ blur: v }); });
    bindRange(r2, (v) => { shadowCtl.querySelector('.v2').textContent = v; setShadow({ offsetY: v, offsetX: v * 0.6 }); });
    shadowCtl.querySelector('.sc').addEventListener('click', (e) => colorPicker(e.currentTarget, { value: '#000000', onPick: (c) => setShadow({ color: hexA(c, 0.45) }) }));

    const outSec = sec('Outline');
    const hasOut = !!o.stroke && o.strokeWidth > 0;
    outSec.appendChild(h(`<label class="toggle">Text outline<input type="checkbox" ${hasOut ? 'checked' : ''}></label>`));
    const outCtl = h(`<div ${hasOut ? '' : 'hidden'}><div class="field"><label>Thickness <span class="v">${o.strokeWidth || 1}</span></label><input type="range" min="0.5" max="12" step="0.5" value="${o.strokeWidth || 1}"></div>
      <div class="field-row"><span class="muted">Colour</span><button class="fill-btn stroke oc"><span style="--c:${esc(o.stroke || '#1f1f1f')}"></span></button></div></div>`);
    outSec.appendChild(outCtl);
    outSec.querySelector('input[type=checkbox]').addEventListener('change', (e) => {
      outCtl.hidden = !e.target.checked;
      if (e.target.checked) { a.setTextProp('stroke', o.stroke || '#1f1f1f'); a.setTextProp('strokeWidth', 1); o.set('paintFirst', 'stroke'); }
      else { a.setTextProp('stroke', null); a.setTextProp('strokeWidth', 0); }
    });
    bindRange(outCtl.querySelector('input[type=range]'), (v) => { outCtl.querySelector('.v').textContent = v; o.set('paintFirst', 'stroke'); a.setTextProp('strokeWidth', v); });
    outCtl.querySelector('.oc').addEventListener('click', (e) => colorPicker(e.currentTarget, { value: o.stroke, onPick: (c) => a.setTextProp('stroke', c) }));

    const hlSec = sec('Highlight behind text');
    const hl = h(`<div class="field-row"><button class="fill-btn"><span style="--c:${esc(a.textValue('textBackgroundColor') || 'transparent')}"></span></button><span class="muted">Marks the selected words, like a text marker</span></div>`);
    hl.querySelector('button').addEventListener('click', (e) => colorPicker(e.currentTarget, { value: a.textValue('textBackgroundColor'), allowNone: true, title: 'Highlight', onPick: (c) => a.setTextProp('textBackgroundColor', c === 'transparent' ? '' : c) }));
    hlSec.appendChild(hl);

    const bgSec = sec('Box background');
    const bg = h(`<div class="field-row"><button class="fill-btn"><span style="--c:${esc(o.backgroundColor || 'transparent')}"></span></button><span class="muted">Fills the whole text box</span></div>`);
    bg.querySelector('button').addEventListener('click', (e) => colorPicker(e.currentTarget, { value: o.backgroundColor, allowNone: true, title: 'Box background', onPick: (c) => a.setProp('backgroundColor', c === 'transparent' ? '' : c) }));
    bgSec.appendChild(bg);

    const opSec = sec('Transparency');
    const op = h(`<input type="range" min="0" max="100" value="${Math.round((o.opacity ?? 1) * 100)}">`);
    bindRange(op, (v) => a.setProp('opacity', v / 100, 'opacity'));
    opSec.appendChild(op);
  }

  // ---------- image ----------
  render_image(body) {
    const s = this.ed.selection();
    const img = s?.object;
    if (!img || img.type !== 'image') { this.empty(body, 'Select an image to adjust it.'); return; }
    const a = this.app.actions;
    const sec = h('<div class="rp-section"><h3>Adjust</h3></div>');
    const slider = (label, name, min, max, step) => {
      const v = a.filterValue(name);
      const f = h(`<div class="field"><label>${esc(label)} <span class="v">${Math.round(v * 100)}</span></label><input type="range" min="${min}" max="${max}" step="${step}" value="${v}"></div>`);
      bindRange(f.querySelector('input'), (x) => { f.querySelector('.v').textContent = Math.round(x * 100); a.setImageFilter(name, x); });
      sec.appendChild(f);
    };
    slider('Brightness', 'Brightness', -0.6, 0.6, 0.01);
    slider('Contrast', 'Contrast', -0.6, 0.6, 0.01);
    slider('Saturation', 'Saturation', -1, 1, 0.01);
    slider('Blur', 'Blur', 0, 0.5, 0.01);
    body.appendChild(sec);
    const fx = h(`<div class="rp-section"><h3>Filters</h3>
      <label class="toggle">Black and white<input type="checkbox" data-f="Grayscale" ${a.filterValue('Grayscale') ? 'checked' : ''}></label>
      <label class="toggle">Sepia<input type="checkbox" data-f="Sepia" ${a.filterValue('Sepia') ? 'checked' : ''}></label>
      <button class="btn small" style="margin-top:8px">Reset adjustments</button></div>`);
    fx.querySelectorAll('[data-f]').forEach((c) => c.addEventListener('change', () => a.setImageFilter(c.dataset.f, c.checked ? 1 : 0)));
    fx.querySelector('button').addEventListener('click', () => { img.filters = []; img.applyFilters(); s.fc.requestRenderAll(); this.ed.commit(s.view); this.render(); });
    body.appendChild(fx);
    const shadow = h(`<div class="rp-section"><h3>Frame</h3><label class="toggle">Drop shadow<input type="checkbox" ${img.shadow ? 'checked' : ''}></label></div>`);
    shadow.querySelector('input').addEventListener('change', (e) => a.setProp('shadow', e.target.checked ? new fabric.Shadow({ color: 'rgba(0,0,0,0.3)', blur: 18, offsetX: 0, offsetY: 6 }) : null));
    body.appendChild(shadow);
  }

  // ---------- search ----------
  render_search(body) {
    const box = h(`<div class="rp-section"><input class="input" placeholder="Search text and PDF pages" autofocus value="${esc(this.lastQuery || '')}"></div>`);
    const results = h('<div class="results"></div>');
    body.append(box, results);
    const input = box.querySelector('input');
    input.addEventListener('keydown', (e) => e.stopPropagation());
    const run = debounce(() => this.search(input.value, results), 220);
    input.addEventListener('input', run);
    requestAnimationFrame(() => { input.focus(); input.select(); });
    if (this.lastQuery) this.search(this.lastQuery, results);
  }

  async search(q, results) {
    this.lastQuery = q;
    const token = (this.searchToken = Symbol('search'));
    results.innerHTML = '';
    q = q.trim();
    if (q.length < 2) return;
    const lower = q.toLowerCase();
    const found = [];
    const ctxOf = (str) => {
      const i = str.toLowerCase().indexOf(lower);
      const start = Math.max(0, i - 30);
      return `${start ? '…' : ''}${esc(str.slice(start, i))}<mark>${esc(str.slice(i, i + q.length))}</mark>${esc(str.slice(i + q.length, i + q.length + 50))}`;
    };
    this.app.tools.textCache ||= new Map();
    for (const [i, p] of this.ed.pages.entries()) {
      for (const o of p.data?.objects || []) {
        if ((o.type === 'textbox' || o.type === 'sticky') && o.text?.toLowerCase().includes(lower)) {
          found.push({ pageIndex: i, pageId: p.id, html: ctxOf(o.text.replace(/\n/g, ' ')), rect: { x: o.left, y: o.top, w: o.width * (o.scaleX || 1), h: 24 } });
        }
      }
      if (p.pdf) {
        const a = this.ed.assets.get(p.pdf.assetId);
        const key = `${p.pdf.assetId}:${p.pdf.pageIndex}`;
        if (!this.app.tools.textCache.has(key)) this.app.tools.textCache.set(key, pdf.pdfTextItems(p.pdf.assetId, a.bytes, p.pdf.pageIndex).catch(() => []));
        const items = await this.app.tools.textCache.get(key);
        if (token !== this.searchToken) return;
        for (const it of items) {
          if (it.str.toLowerCase().includes(lower)) found.push({ pageIndex: i, pageId: p.id, html: ctxOf(it.str), rect: { x: it.x, y: it.y, w: it.width, h: it.height } });
        }
      }
      if (found.length > 300) break;
    }
    if (token !== this.searchToken) return;
    results.innerHTML = '';
    results.appendChild(h(`<div class="muted" style="padding:0 0 8px">${found.length} result${found.length === 1 ? '' : 's'}</div>`));
    for (const f of found) {
      const b = h(`<button class="result"><div class="rp">Page ${f.pageIndex + 1}</div><div>${f.html}</div></button>`);
      b.addEventListener('click', () => this.app.flashRect(f.pageId, f.rect));
      results.appendChild(b);
    }
  }

  // ---------- annotations ----------
  render_annotations(body) {
    let count = 0;
    for (const [i, p] of this.ed.pages.entries()) {
      const notes = [];
      for (const o of p.data?.objects || []) {
        if (o.type === 'sticky') notes.push({ c: o.stickyColor, title: 'Sticky note', text: o.text });
        else if (o.textMark || (o.isInk && o.inkType === 'highlighter')) notes.push({ c: o.fill, title: o.textMark === 'underline' ? 'Underline' : o.textMark === 'strike' ? 'Strikethrough' : 'Highlight', text: '' });
        else if (o.isTape) notes.push({ c: o.fill, title: 'Study tape', text: '' });
        else if (o.linkPage || o.linkUrl) notes.push({ c: '#0f6cbd', title: 'Link', text: o.linkUrl || `Page ${this.ed.pageIndex(o.linkPage) + 1}` });
      }
      if (!notes.length) continue;
      body.appendChild(h(`<div class="ol-section">Page ${i + 1}</div>`));
      for (const n of notes) {
        count++;
        const b = h(`<button class="annot"><span class="dot" style="--c:${esc(n.c || '#999')}"></span><span class="body"><small>${esc(n.title)}</small><div>${esc(n.text || '')}</div></span></button>`);
        b.addEventListener('click', () => this.ed.setActivePage(p.id, { scroll: true }));
        body.appendChild(b);
      }
    }
    if (!count) this.empty(body, 'Sticky notes, highlights, study tape and links in this notebook are listed here.');
  }

  // ---------- elements ----------
  render_elements(body) {
    const els = this.app.settings.elements || [];
    const top = h(`<div class="rp-section"><p class="muted" style="margin:0 0 10px">Reusable stickers, stamps and signatures. Select anything on a page and choose “Add to elements”.</p>
      <div class="field-row"><button class="btn small grow" data-a="sig">${icon('pen', 16)} New signature</button><button class="btn small grow" data-a="add">${icon('plus', 16)} Add selection</button></div></div>`);
    top.querySelector('[data-a=sig]').addEventListener('click', () => this.app.dialogs.signature());
    top.querySelector('[data-a=add]').addEventListener('click', () => this.app.saveAsElement());
    body.appendChild(top);
    const grid = h('<div class="el-grid"></div>');
    if (!els.length) this.empty(body, 'No elements yet.');
    for (const el of els) {
      const card = h(`<div class="el-card" role="button" tabindex="0" title="${esc(el.name)} — click to insert, or drag onto a page" draggable="true"><img alt="" src="${el.thumb}"><button class="ibtn del" title="Remove">${icon('close', 14)}</button></div>`);
      card.addEventListener('click', (e) => { if (!e.target.closest('.del')) this.app.insertElement(el); });
      card.addEventListener('dragstart', (e) => e.dataTransfer.setData('application/x-inknote-element', el.id));
      card.querySelector('.del').addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.saveSettings({ elements: els.filter((x) => x !== el) });
        this.render();
      });
      grid.appendChild(card);
    }
    body.appendChild(grid);
  }
}

function hexA(hex, a) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(hex);
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}
