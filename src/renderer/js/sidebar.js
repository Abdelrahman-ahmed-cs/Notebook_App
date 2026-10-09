// Page sidebar: thumbnails with insert-between, drag reorder, multi-select, context menu; outline view.
import { h, esc, menu, toast, prompt } from './ui.js';
import { icon } from './icons.js';
import { requestThumb } from './exporter.js';

export class Sidebar {
  constructor(app) {
    this.app = app;
    this.ed = app.ed;
    this.list = document.getElementById('thumbs');
    this.outlineEl = document.getElementById('outline');
    this.selected = new Set();
    this.anchor = null;
    this.view = 'pages';
    this.items = new Map(); // pageId -> element

    this.ed.on('pages', () => this.render());
    this.ed.on('document', () => { this.selected.clear(); this.render(); });
    this.ed.on('pageContent', (id) => this.refreshThumb(id));
    this.ed.on('activePage', () => this.markCurrent());
    this.ed.on('visiblePage', () => this.markCurrent());

    document.querySelectorAll('#sidebar [data-side]').forEach((b) => b.addEventListener('click', () => this.show(b.dataset.side)));
    this.initResize();
    this.list.addEventListener('keydown', (e) => this.onKey(e));
    this.list.addEventListener('dragover', (e) => this.onDragOver(e));
    this.list.addEventListener('drop', (e) => this.onDrop(e));
    this.list.addEventListener('dragleave', (e) => { if (!this.list.contains(e.relatedTarget)) this.clearDrop(); });

    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) this.loadThumb(en.target);
    }, { root: this.list, rootMargin: '400px 0px' });
    this.thumbIO = io;
  }

  show(view) {
    this.view = view;
    document.querySelectorAll('#sidebar [data-side]').forEach((b) => b.classList.toggle('on', b.dataset.side === view));
    this.list.hidden = view !== 'pages';
    this.outlineEl.hidden = view !== 'outline';
    if (view === 'outline') this.renderOutline();
  }

  thumbWidth() {
    return Math.max(80, this.list.clientWidth - 32);
  }

  render() {
    const pages = this.ed.pages;
    document.getElementById('page-count').textContent = `${pages.length} page${pages.length === 1 ? '' : 's'}`;
    document.getElementById('page-total').textContent = pages.length;
    for (const id of [...this.selected]) if (!this.ed.page(id)) this.selected.delete(id);
    this.thumbIO.disconnect();
    this.list.innerHTML = '';
    this.items.clear();
    const w = this.thumbWidth();
    pages.forEach((p, i) => {
      if (i > 0) this.list.appendChild(this.gap(i));
      const el = h(`<div class="thumb" draggable="true" data-id="${p.id}" title="Page ${i + 1}">
        <div class="tcard" style="aspect-ratio:${p.width}/${p.height}"></div>
        <div class="tnum">${p.bookmark ? icon('bookmarkFilled', 12) : ''}${i + 1}${p.label ? ` · ${esc(p.label)}` : ''}</div>
        <button class="tmore" title="Page options">${icon('more', 16)}</button>
      </div>`);
      el.style.setProperty('--w', `${w}px`);
      el.addEventListener('click', (e) => this.onClick(e, p.id));
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!this.selected.has(p.id)) this.selectOnly(p.id); this.contextMenu({ x: e.clientX, y: e.clientY }); });
      el.querySelector('.tmore').addEventListener('click', (e) => { e.stopPropagation(); if (!this.selected.has(p.id)) this.selectOnly(p.id); this.contextMenu(e.currentTarget); });
      el.addEventListener('dragstart', (e) => this.onDragStart(e, p.id));
      el.addEventListener('dragend', () => { this.dragIds = null; this.clearDrop(); this.list.querySelectorAll('.dragging').forEach((n) => n.classList.remove('dragging')); });
      if (this.selected.has(p.id)) el.classList.add('selected');
      this.items.set(p.id, el);
      this.list.appendChild(el);
      this.thumbIO.observe(el);
    });
    const ghost = h(`<button class="ghost-add">${icon('plus', 16)} Add page</button>`);
    ghost.addEventListener('click', () => this.app.addPageAt(pages.length));
    this.list.appendChild(ghost);
    this.markCurrent();
    if (this.view === 'outline') this.renderOutline();
  }

  gap(index) {
    const g = h(`<div class="gap-add"><button title="Insert a blank page here">${icon('plus', 14)}</button></div>`);
    g.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); this.app.addPageAt(index); });
    return g;
  }

  loadThumb(el) {
    const page = this.ed.page(el.dataset.id);
    if (!page) return;
    const card = el.querySelector('.tcard');
    requestThumb(this.ed, page, this.thumbWidth(), (url) => {
      if (this.ed.page(page.id) !== page && this.ed.page(page.id)) return;
      card.innerHTML = `<img alt="" src="${url}">`;
    });
  }

  refreshThumb(id) {
    clearTimeout(this.thumbTimers?.[id]);
    this.thumbTimers ||= {};
    this.thumbTimers[id] = setTimeout(() => {
      const el = this.items.get(id);
      if (el) this.loadThumb(el);
    }, 450);
  }

  markCurrent() {
    const cur = this.ed.visiblePageId || this.ed.activePageId;
    for (const [id, el] of this.items) el.classList.toggle('current', id === cur);
    const idx = this.ed.pageIndex(cur);
    const input = document.getElementById('page-input');
    if (document.activeElement !== input) input.value = idx >= 0 ? idx + 1 : 1;
    const el = this.items.get(cur);
    if (el && this.view === 'pages') {
      const r = el.getBoundingClientRect();
      const lr = this.list.getBoundingClientRect();
      if (r.top < lr.top || r.bottom > lr.bottom) el.scrollIntoView({ block: 'nearest' });
    }
  }

  selectOnly(id) {
    this.selected = new Set([id]);
    this.anchor = id;
    for (const [pid, el] of this.items) el.classList.toggle('selected', pid === id);
  }

  onClick(e, id) {
    if (e.ctrlKey || e.metaKey) {
      if (this.selected.has(id)) this.selected.delete(id); else this.selected.add(id);
      this.anchor = id;
    } else if (e.shiftKey && this.anchor) {
      const a = this.ed.pageIndex(this.anchor);
      const b = this.ed.pageIndex(id);
      this.selected = new Set(this.ed.pages.slice(Math.min(a, b), Math.max(a, b) + 1).map((p) => p.id));
    } else {
      this.selectOnly(id);
      this.ed.setActivePage(id, { scroll: true });
    }
    for (const [pid, el] of this.items) el.classList.toggle('selected', this.selected.has(pid));
    this.list.focus();
  }

  selectedIds() {
    const ids = this.ed.pages.filter((p) => this.selected.has(p.id)).map((p) => p.id);
    return ids.length ? ids : [this.ed.activePageId];
  }

  onKey(e) {
    const ids = this.selectedIds();
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); this.app.deletePages(ids); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); e.stopPropagation(); this.ed.duplicatePages(ids); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      const i = this.ed.pageIndex(this.ed.activePageId) + (e.key === 'ArrowDown' ? 1 : -1);
      const p = this.ed.pages[i];
      if (p) { this.selectOnly(p.id); this.ed.setActivePage(p.id, { scroll: true }); }
    }
  }

  contextMenu(anchor) {
    const ids = this.selectedIds();
    const many = ids.length > 1;
    const first = this.ed.page(ids[0]);
    const idx = this.ed.pageIndex(ids[0]);
    menu([
      many ? { head: `${ids.length} pages selected` } : null,
      { label: 'Add page before', icon: 'pagePlus', action: () => this.app.addPageAt(idx) },
      { label: 'Add page after', icon: 'pagePlus', action: () => this.app.addPageAt(this.ed.pageIndex(ids[ids.length - 1]) + 1) },
      { label: many ? 'Duplicate pages' : 'Duplicate', icon: 'duplicate', key: 'Ctrl+D', action: () => this.ed.duplicatePages(ids) },
      '-',
      { label: 'Change template…', icon: 'grid', action: () => this.app.dialogs.pageSetup(ids) },
      { label: 'Rotate page', icon: 'rotate', action: () => this.app.rotatePages(ids) },
      { label: 'Move to start', disabled: idx === 0, action: () => this.ed.movePages(ids, 0) },
      { label: 'Move to end', action: () => this.ed.movePages(ids, this.ed.pages.length) },
      '-',
      { label: first.bookmark ? 'Remove bookmark' : 'Bookmark', icon: 'bookmark', action: () => this.app.toggleBookmark(ids) },
      { label: 'Rename page…', action: async () => {
        const n = await prompt('Page name', first.label || '', { label: 'Shown in the sidebar, outline and exported PDF bookmarks' });
        if (n !== null) this.ed.updatePage(first.id, { label: n.trim() });
      } },
      { label: 'Export page as PNG…', icon: 'export', action: () => this.app.exportPng(first.id) },
      { label: 'Export selected pages as PDF…', icon: 'pdf', action: () => this.app.dialogs.exportPdf(ids) },
      '-',
      { label: many ? `Delete ${ids.length} pages` : 'Delete page', icon: 'trash', danger: true, key: 'Del', action: () => this.app.deletePages(ids) },
    ], anchor);
  }

  // ---------- drag reorder (and dropping objects/files on thumbnails) ----------
  onDragStart(e, id) {
    if (!this.selected.has(id)) this.selectOnly(id);
    this.dragIds = this.selectedIds();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-inknote-pages', JSON.stringify(this.dragIds));
    this.dragIds.forEach((pid) => this.items.get(pid)?.classList.add('dragging'));
  }

  dropTarget(e) {
    const el = e.target.closest('.thumb');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const after = e.clientY > r.top + r.height / 2;
    return { el, id: el.dataset.id, after };
  }

  clearDrop() {
    this.list.querySelectorAll('.drop-before,.drop-after').forEach((n) => n.classList.remove('drop-before', 'drop-after'));
  }

  onDragOver(e) {
    if (!this.dragIds) return;
    e.preventDefault();
    const t = this.dropTarget(e);
    this.clearDrop();
    if (t) t.el.classList.add(t.after ? 'drop-after' : 'drop-before');
    const lr = this.list.getBoundingClientRect();
    if (e.clientY < lr.top + 40) this.list.scrollTop -= 12;
    if (e.clientY > lr.bottom - 40) this.list.scrollTop += 12;
  }

  onDrop(e) {
    if (!this.dragIds) return;
    e.preventDefault();
    const t = this.dropTarget(e);
    this.clearDrop();
    if (!t) return;
    let index = this.ed.pageIndex(t.id) + (t.after ? 1 : 0);
    this.ed.movePages(this.dragIds, index);
    toast(this.dragIds.length > 1 ? `Moved ${this.dragIds.length} pages` : 'Page moved', { action: () => this.ed.undo() });
    this.dragIds = null;
    index = 0;
  }

  initResize() {
    const handle = document.getElementById('side-resizer');
    const saved = this.app.settings.sidebarWidth;
    if (saved) document.documentElement.style.setProperty('--sidebar-w', `${saved}px`);
    handle.addEventListener('pointerdown', (e) => {
      handle.setPointerCapture(e.pointerId);
      handle.classList.add('drag');
      const move = (ev) => {
        const w = Math.max(160, Math.min(360, ev.clientX));
        document.documentElement.style.setProperty('--sidebar-w', `${w}px`);
      };
      const up = () => {
        handle.classList.remove('drag');
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        const w = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w'), 10);
        this.app.saveSettings({ sidebarWidth: w });
        this.ed.thumbCache = new WeakMap();
        this.render();
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
    });
  }

  // ---------- outline ----------
  renderOutline() {
    const el = this.outlineEl;
    el.innerHTML = '';
    const pages = this.ed.pages;
    const bookmarks = pages.filter((p) => p.bookmark || p.label);
    const outline = (this.ed.meta.outline || []).filter((o) => this.ed.page(o.pageId));
    const row = (text, pageId, level = 0, extra) => {
      const b = h(`<button class="ol-item" style="padding-left:${8 + level * 14}px">${extra || ''}<span class="txt">${esc(text)}</span><span class="pg">${this.ed.pageIndex(pageId) + 1}</span></button>`);
      b.addEventListener('click', () => this.ed.setActivePage(pageId, { scroll: true }));
      return b;
    };
    el.appendChild(h('<div class="ol-section">Bookmarks</div>'));
    if (!bookmarks.length) el.appendChild(h('<div class="ol-empty">Right-click a page and choose Bookmark to pin it here.</div>'));
    for (const p of bookmarks) el.appendChild(row(p.label || `Page ${this.ed.pageIndex(p.id) + 1}`, p.id, 0, icon('bookmarkFilled', 14)));

    const head = h(`<div class="ol-section" style="display:flex;align-items:center;justify-content:space-between">Outline<button class="ibtn" title="Add the current page to the outline">${icon('plus', 16)}</button></div>`);
    head.querySelector('button').addEventListener('click', async () => {
      const id = this.ed.activePageId;
      const t = await prompt('Add to outline', '', { label: `Title for page ${this.ed.pageIndex(id) + 1}`, okLabel: 'Add' });
      if (!t) return;
      this.ed.meta.outline = [...(this.ed.meta.outline || []), { title: t, pageId: id, level: 0 }];
      this.ed.setDirty(true);
      this.renderOutline();
    });
    el.appendChild(head);
    if (!outline.length) el.appendChild(h('<div class="ol-empty">Headings imported from PDFs and entries you add appear here, and become bookmarks in exported PDFs.</div>'));
    outline.forEach((o, i) => {
      const b = row(o.title, o.pageId, o.level || 0);
      b.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        menu([
          { label: 'Rename…', action: async () => { const t = await prompt('Rename', o.title); if (t) { o.title = t; this.ed.setDirty(true); this.renderOutline(); } } },
          { label: 'Remove', danger: true, action: () => { this.ed.meta.outline.splice(this.ed.meta.outline.indexOf(o), 1); this.ed.setDirty(true); this.renderOutline(); } },
        ], { x: e.clientX, y: e.clientY });
      });
      el.appendChild(b);
      return i;
    });
  }
}
