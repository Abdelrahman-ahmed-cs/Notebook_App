// Application shell: wires the editor, tools and UI together; menus, shortcuts, files.
import './fabric-setup.js';
import { Editor } from './editor.js';
import { ToolController } from './tools.js';
import { Actions } from './actions.js';
import { TextStyles } from './fonts.js';
import { ToolContext } from './toolctx.js';
import { SelectionBar } from './selbar.js';
import { Sidebar } from './sidebar.js';
import { Panels } from './panels.js';
import { Dialogs } from './dialogs.js';
import { AudioNotes } from './audio.js';
import { Presenter } from './present.js';
import { Home } from './home.js';
import { Assets, newPage, serialize, deserialize, MIME_BY_EXT, uid } from './doc.js';
import * as pdf from './pdf.js';
import * as exporter from './exporter.js';
import { hydrateIcons } from './icons.js';
import { $, $$, h, menu, toast, modal, prompt, closeFlyouts, hasFlyout } from './ui.js';

const { fabric } = window;

class App {
  async init() {
    hydrateIcons();
    this.settings = (await window.native.getSettings()) || {};
    this.applyTheme();
    if (this.settings.darkPaper) document.body.classList.add('dark-paper');
    if (this.settings.sidebarHidden) document.body.classList.add('sidebar-hidden');

    this.ed = new Editor({ viewport: $('#viewport'), column: $('#pages') });
    this.tools = new ToolController(this.ed, this.settings.tools);
    this.actions = new Actions(this);
    this.textStyles = new TextStyles(this);
    this.dialogs = new Dialogs(this);
    this.toolCtx = new ToolContext(this);
    this.selbar = new SelectionBar(this);
    this.sidebar = new Sidebar(this);
    this.panels = new Panels(this);
    this.audio = new AudioNotes(this);
    this.presenter = new Presenter(this);
    this.home = new Home(this);

    this.wireEditorEvents();
    this.wireToolbar();
    this.wireMenubar();
    this.wireKeyboard();
    this.wireViewport();
    this.wireDragDrop();
    this.wireStatus();
    this.wireNative();

    this.ed.newDocument({ template: 'lined', title: 'Untitled notebook' });
    this.ed.setDirty(false);
    this.toolCtx.render();
    requestAnimationFrame(() => this.ed.fitWidth(1.15));

    const pending = await window.native.pendingOpen();
    const recovered = await this.offerRecovery();
    if (pending) await this.openPath(pending);
    else if (!recovered && this.settings.showHome !== false) this.home.show();

    setInterval(() => this.autosave(), 60000);
  }

  // ---------- settings & theme ----------
  saveSettings(patch) {
    Object.assign(this.settings, patch);
    return window.native.setSettings(patch);
  }

  applyTheme() {
    const pref = this.settings.theme || 'system';
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const dark = pref === 'dark' || (pref === 'system' && mq.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    window.native.setTheme(dark);
    if (!this.mqBound) {
      this.mqBound = true;
      mq.addEventListener('change', () => this.applyTheme());
    }
  }

  setTheme(t) {
    this.saveSettings({ theme: t });
    this.applyTheme();
  }

  // ---------- editor events ----------
  wireEditorEvents() {
    const ed = this.ed;
    ed.on('toast', (msg, undoable) => toast(msg, undoable ? { action: () => ed.undo() } : {}));
    ed.on('dirty', () => this.updateTitle());
    ed.on('document', () => this.updateTitle());
    ed.on('history', () => {
      $('#btn-undo').disabled = !ed.canUndo();
      $('#btn-redo').disabled = !ed.canRedo();
    });
    ed.on('zoom', (z) => { $('#zoom-label').textContent = `${Math.round(z * 100)}%`; });
    ed.on('createText', (fc, p) => this.actions.insertText({ at: { x: p.x, y: p.y - 10 }, view: fc.view }));
    ed.on('dblclick', (fc, target) => {
      if (target?.type === 'image' && this.tools.tool === 'select') this.dialogs.crop();
    });
    ed.on('followLink', (o) => this.followLink(o));
    ed.on('requestAddPageAfter', (id) => this.addPageAt(ed.pageIndex(id) + 1));
  }

  updateTitle() {
    $('#doc-name').textContent = this.ed.title;
    $('#dirty-dot').hidden = !this.ed.dirty;
    window.native.setTitle(`${this.ed.dirty ? '● ' : ''}${this.ed.title} — InkNote Studio`);
  }

  // ---------- commands ----------
  get commands() {
    const a = this.actions;
    const ed = this.ed;
    return {
      undo: () => ed.undo(),
      redo: () => ed.redo(),
      toggleSidebar: () => {
        document.body.classList.toggle('sidebar-hidden');
        requestAnimationFrame(() => ed.emit('viewport'));
        this.saveSettings({ sidebarHidden: document.body.classList.contains('sidebar-hidden') });
      },
      insertImage: () => this.insertImageDialog(),
      addSticky: () => a.addSticky(),
      addPage: () => this.addPageAt(ed.pageIndex(ed.visiblePageId || ed.activePageId) + 1),
      addPageEnd: () => this.addPageAt(ed.pages.length),
      exportPdf: () => this.dialogs.exportPdf(this.sidebar.selected.size > 1 ? this.sidebar.selectedIds() : null),
      record: () => this.audio.toggle(),
      present: () => this.presenter.start(),
      zoomIn: () => ed.setZoom(ed.zoom * 1.2),
      zoomOut: () => ed.setZoom(ed.zoom / 1.2),
      fitWidth: () => ed.fitWidth(),
      fitPage: () => ed.fitPage(),
      zoom100: () => ed.setZoom(1),
      search: () => this.panels.open('search', { toggle: false }),
    };
  }

  run(cmd) {
    const fn = this.commands[cmd];
    if (fn) fn();
  }

  wireToolbar() {
    $$('[data-cmd]').forEach((b) => b.addEventListener('click', () => this.run(b.dataset.cmd)));
    $('#search-open').addEventListener('click', () => this.panels.open('search', { toggle: false }));
    $('#doc-title').addEventListener('click', async () => {
      const n = await prompt('Rename notebook', this.ed.title, { okLabel: 'Rename' });
      if (n && n.trim()) { this.ed.title = n.trim(); this.ed.setDirty(true); this.updateTitle(); }
    });
  }

  // ---------- menubar ----------
  wireMenubar() {
    $$('#menubar button').forEach((b) => {
      b.addEventListener('click', () => this.openMenu(b));
      b.addEventListener('mouseenter', () => {
        if ($('#menubar button.open') && !b.classList.contains('open')) this.openMenu(b);
      });
    });
  }

  openMenu(btn) {
    $$('#menubar button').forEach((x) => x.classList.toggle('open', x === btn));
    const items = this.menuItems(btn.dataset.menu);
    menu(items, btn, { onClose: () => btn.classList.remove('open') });
  }

  menuItems(name) {
    const a = this.actions;
    const ed = this.ed;
    const s = ed.selection();
    const t = this.tools;
    switch (name) {
      case 'file': return [
        { label: 'New notebook…', icon: 'newDoc', key: 'Ctrl+N', action: () => this.dialogs.newNotebook() },
        { label: 'Open…', icon: 'open', key: 'Ctrl+O', action: () => this.openDialog() },
        { label: 'Open recent', submenu: () => this.recentMenu() },
        { label: 'Start screen', icon: 'grid', action: () => this.home.show() },
        '-',
        { label: 'Save', icon: 'save', key: 'Ctrl+S', action: () => this.save() },
        { label: 'Save as…', key: 'Ctrl+Shift+S', action: () => this.save(true) },
        '-',
        { label: 'Insert PDF pages…', icon: 'pdf', action: () => this.importPdfDialog() },
        { label: 'Insert images as pages…', icon: 'image', action: () => this.importImagesAsPages(false) },
        '-',
        { label: 'Export as PDF…', icon: 'export', key: 'Ctrl+Shift+E', action: () => this.run('exportPdf') },
        { label: 'Export page as PNG…', action: () => this.exportPng(ed.visiblePageId || ed.activePageId) },
        { label: 'Print…', key: 'Ctrl+P', action: () => this.print() },
        '-',
        { label: 'Settings…', icon: 'sliders', action: () => this.dialogs.settings() },
        { label: 'Exit', action: () => window.close() },
      ];
      case 'edit': return [
        { label: 'Undo', icon: 'undo', key: 'Ctrl+Z', disabled: !ed.canUndo(), action: () => ed.undo() },
        { label: 'Redo', icon: 'redo', key: 'Ctrl+Y', disabled: !ed.canRedo(), action: () => ed.redo() },
        '-',
        { label: 'Cut', key: 'Ctrl+X', disabled: !s, action: () => a.cut() },
        { label: 'Copy', icon: 'copy', key: 'Ctrl+C', disabled: !s, action: () => a.copy() },
        { label: 'Paste', key: 'Ctrl+V', disabled: !a.clip, action: () => a.pasteObjects() },
        { label: 'Duplicate', icon: 'duplicate', key: 'Ctrl+D', disabled: !s, action: () => a.duplicate() },
        { label: 'Delete', icon: 'trash', key: 'Del', disabled: !s, action: () => a.remove() },
        '-',
        { label: 'Select all on page', key: 'Ctrl+A', action: () => a.selectAll() },
        { label: 'Copy style', icon: 'paint', key: 'Ctrl+Alt+C', disabled: !s, action: () => a.copyStyle() },
        { label: 'Paste style', key: 'Ctrl+Alt+V', disabled: !s || !a.styleClip, action: () => a.pasteStyle() },
        '-',
        { label: 'Search…', icon: 'search', key: 'Ctrl+F', action: () => this.panels.open('search', { toggle: false }) },
      ];
      case 'insert': return [
        { label: 'Text box', icon: 'text', key: 'T', action: () => a.insertText({ selectAll: true, text: 'Text' }) },
        { label: 'Sticky note', icon: 'sticky', key: 'N', action: () => a.addSticky() },
        { label: 'Image…', icon: 'image', key: 'I', action: () => this.insertImageDialog() },
        { label: 'Shape', icon: 'shapes', submenu: () => ['rect', 'roundRect', 'ellipse', 'triangle', 'diamond', 'star', 'line', 'arrow'].map((k) => ({
          label: { rect: 'Rectangle', roundRect: 'Rounded rectangle', ellipse: 'Ellipse', triangle: 'Triangle', diamond: 'Diamond', star: 'Star', line: 'Line', arrow: 'Arrow' }[k],
          icon: k, action: () => { t.cfg.shape.kind = k; t.setTool('shape'); },
        })) },
        { label: 'Study tape', icon: 'tape', action: () => t.setTool('tape') },
        { label: 'Signature…', icon: 'pen', action: () => this.dialogs.signature() },
        { label: 'Elements…', icon: 'sticky', action: () => this.panels.open('elements') },
        { label: 'Link…', icon: 'link', disabled: !s, action: () => this.dialogs.link() },
        '-',
        { label: 'Page after current', icon: 'pagePlus', key: 'Ctrl+Shift+N', action: () => this.run('addPage') },
        { label: 'PDF pages…', icon: 'pdf', action: () => this.importPdfDialog() },
        { label: 'Images as pages…', action: () => this.importImagesAsPages(false) },
      ];
      case 'page': {
        const id = ed.visiblePageId || ed.activePageId;
        const p = ed.page(id);
        const i = ed.pageIndex(id);
        return [
          { label: 'Add page before', icon: 'pagePlus', action: () => this.addPageAt(i) },
          { label: 'Add page after', icon: 'pagePlus', key: 'Ctrl+Shift+N', action: () => this.addPageAt(i + 1) },
          { label: 'Duplicate page', icon: 'duplicate', action: () => ed.duplicatePages([id]) },
          { label: 'Delete page', icon: 'trash', danger: true, action: () => this.deletePages([id]) },
          '-',
          { label: 'Page setup…', icon: 'grid', action: () => this.dialogs.pageSetup([id]) },
          { label: 'Rotate page', icon: 'rotate', action: () => this.rotatePages([id]) },
          { label: p?.bookmark ? 'Remove bookmark' : 'Bookmark page', icon: 'bookmark', action: () => this.toggleBookmark([id]) },
          '-',
          { label: 'Move page up', disabled: i === 0, action: () => ed.movePages([id], i - 1) },
          { label: 'Move page down', disabled: i === ed.pages.length - 1, action: () => ed.movePages([id], i + 2) },
          '-',
          { label: 'Go to page…', action: () => $('#page-input').focus() },
          { label: 'Annotations list', action: () => this.panels.open('annotations') },
        ];
      }
      case 'view': {
        const theme = this.settings.theme || 'system';
        return [
          { label: 'Zoom in', key: 'Ctrl+=', action: () => this.run('zoomIn') },
          { label: 'Zoom out', key: 'Ctrl+−', action: () => this.run('zoomOut') },
          { label: 'Actual size', key: 'Ctrl+0', action: () => ed.setZoom(1) },
          { label: 'Fit page', key: 'Shift+1', action: () => ed.fitPage() },
          { label: 'Fit width', key: 'Shift+2', action: () => ed.fitWidth() },
          '-',
          { label: 'Pages panel', key: 'Ctrl+\\', checked: !document.body.classList.contains('sidebar-hidden'), action: () => this.run('toggleSidebar') },
          { label: 'Outline and bookmarks', icon: 'outline', action: () => { document.body.classList.remove('sidebar-hidden'); this.sidebar.show('outline'); } },
          { label: 'Position and layers', icon: 'layers', action: () => this.panels.open('position') },
          { label: 'Text styles', icon: 'style', action: () => this.panels.open('styles') },
          { label: 'Elements', icon: 'sticky', action: () => this.panels.open('elements') },
          { label: 'Annotations', action: () => this.panels.open('annotations') },
          '-',
          { label: 'Theme', icon: theme === 'dark' ? 'moon' : 'sun', submenu: () => [
            { label: 'System', checked: theme === 'system', action: () => this.setTheme('system') },
            { label: 'Light', checked: theme === 'light', action: () => this.setTheme('light') },
            { label: 'Dark', checked: theme === 'dark', action: () => this.setTheme('dark') },
          ] },
          { label: 'Dark paper', checked: document.body.classList.contains('dark-paper'), action: () => {
            const on = !document.body.classList.contains('dark-paper');
            document.body.classList.toggle('dark-paper', on);
            this.saveSettings({ darkPaper: on });
          } },
          { label: 'Present', icon: 'play', key: 'F5', action: () => this.presenter.start() },
          { label: 'Full screen', key: 'F11', action: () => window.native.toggleFullscreen() },
          '-',
          { label: 'Developer tools', key: 'Ctrl+Shift+I', action: () => window.native.toggleDevTools() },
        ];
      }
      case 'help': return [
        { label: 'Keyboard shortcuts', icon: 'keyboard', key: 'Ctrl+/', action: () => this.dialogs.shortcuts() },
        { label: 'About InkNote Studio', icon: 'info', action: () => this.dialogs.about() },
      ];
      default: return [];
    }
  }

  async recentMenu() {
    const list = await window.native.recentFiles();
    if (!list.length) return [{ label: 'No recent notebooks', disabled: true }];
    return list.map((p) => ({ label: p.split(/[\\/]/).pop(), action: () => this.openPath(p) }));
  }

  // ---------- keyboard ----------
  wireKeyboard() {
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.tools.spaceDown = false;
        document.body.classList.remove('panning');
      }
    });
    document.addEventListener('paste', (e) => {
      if (this.isTyping(e.target)) return;
      e.preventDefault();
      this.actions.paste(e);
    });
    document.addEventListener('copy', (e) => {
      if (this.isTyping(e.target)) return;
      if (this.actions.copy()) e.preventDefault();
    });
    document.addEventListener('cut', (e) => {
      if (this.isTyping(e.target)) return;
      if (this.ed.selection()) { e.preventDefault(); this.actions.cut(); }
    });
  }

  isTyping(target) {
    if (!target) return false;
    if (target.closest?.('.modal, .flyout') && target.matches('input, textarea, select')) return true;
    return target.matches?.('input, textarea, select, [contenteditable="true"]');
  }

  editingText() {
    const s = this.ed.selection();
    return s?.object?.isEditing ? s.object : null;
  }

  onKeyDown(e) {
    if (!$('#present').hidden || $('#modal-root').children.length) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const editing = this.editingText();
    const typingField = !editing && this.isTyping(e.target);
    const a = this.actions;
    const ed = this.ed;
    const stop = () => { e.preventDefault(); e.stopPropagation(); };

    // Global shortcuts that work everywhere.
    if (ctrl && !e.shiftKey && key === 's') { stop(); this.save(); return; }
    if (ctrl && e.shiftKey && key === 's') { stop(); this.save(true); return; }
    if (ctrl && !e.shiftKey && key === 'o') { stop(); this.openDialog(); return; }
    if (ctrl && !e.shiftKey && key === 'n') { stop(); this.dialogs.newNotebook(); return; }
    if (ctrl && e.shiftKey && key === 'e') { stop(); this.run('exportPdf'); return; }
    if (ctrl && key === 'p') { stop(); this.print(); return; }
    if (ctrl && key === 'f') { stop(); this.panels.open('search', { toggle: false }); return; }
    if ((ctrl && key === '/') || key === 'F1') { stop(); this.dialogs.shortcuts(); return; }
    if (key === 'F5') { stop(); this.presenter.start(); return; }
    if (key === 'F11') { stop(); window.native.toggleFullscreen(); return; }
    if (ctrl && e.shiftKey && key === 'i') { stop(); window.native.toggleDevTools(); return; }
    if (typingField) return;

    if (editing) {
      if (ctrl && key === 'b') { stop(); a.setTextProp('fontWeight', ['bold', 700, '700'].includes(a.textValue('fontWeight')) ? 'normal' : 'bold'); }
      else if (ctrl && key === 'i') { stop(); a.setTextProp('fontStyle', a.textValue('fontStyle') === 'italic' ? 'normal' : 'italic'); }
      else if (ctrl && key === 'u') { stop(); a.setTextProp('underline', !a.textValue('underline')); }
      else if (ctrl && e.shiftKey && (key === '>' || key === '.')) { stop(); a.setTextProp('fontSize', Math.round((a.textValue('fontSize') || 16) * 1.1)); }
      else if (ctrl && e.shiftKey && (key === '<' || key === ',')) { stop(); a.setTextProp('fontSize', Math.max(4, Math.round((a.textValue('fontSize') || 16) / 1.1))); }
      else if (ctrl && e.shiftKey && ['l', 'e', 'r', 'j'].includes(key)) { stop(); a.setTextProp('textAlign', { l: 'left', e: 'center', r: 'right', j: 'justify' }[key]); }
      else if (ctrl && (key === 'z' || key === 'y')) { stop(); editing.exitEditing(); if (key === 'z' && !e.shiftKey) ed.undo(); else ed.redo(); }
      return;
    }

    if (key === 'Escape') {
      if (hasFlyout()) { closeFlyouts(); return; }
      if (this.panels.current === 'search') { this.panels.close(); return; }
      if (ed.selection()) { ed.discardSelection(); return; }
      if (this.tools.tool !== 'select') this.tools.setTool('select');
      return;
    }
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      this.tools.spaceDown = true;
      document.body.classList.add('panning');
      return;
    }
    if (ctrl && !e.shiftKey && key === 'z') { stop(); ed.undo(); return; }
    if ((ctrl && key === 'y') || (ctrl && e.shiftKey && key === 'z')) { stop(); ed.redo(); return; }
    if (ctrl && key === 'a') { stop(); a.selectAll(); return; }
    if (ctrl && !e.altKey && key === 'd') { stop(); a.duplicate(); return; }
    if (ctrl && e.altKey && key === 'c') { stop(); a.copyStyle(); return; }
    if (ctrl && e.altKey && key === 'v') { stop(); a.pasteStyle(); return; }
    if (ctrl && !e.shiftKey && key === 'g') { stop(); a.group(); return; }
    if (ctrl && e.shiftKey && key === 'g') { stop(); a.ungroup(); return; }
    if (ctrl && key === ']') { stop(); a.arrange(e.altKey ? 'front' : 'forward'); return; }
    if (ctrl && key === '[') { stop(); a.arrange(e.altKey ? 'back' : 'backward'); return; }
    if (e.altKey && e.shiftKey && key === 'l') { stop(); a.toggleLock(); return; }
    if (ctrl && e.shiftKey && key === 'n') { stop(); this.run('addPage'); return; }
    if (ctrl && e.shiftKey && key === 'k') { stop(); a.changeCase(); return; }
    if (ctrl && key === '\\') { stop(); this.run('toggleSidebar'); return; }
    if (ctrl && (key === '=' || key === '+')) { stop(); this.run('zoomIn'); return; }
    if (ctrl && key === '-') { stop(); this.run('zoomOut'); return; }
    if (ctrl && key === '0') { stop(); ed.setZoom(1); return; }
    if (e.shiftKey && key === '!') { stop(); ed.fitPage(); return; }
    if (e.shiftKey && key === '@') { stop(); ed.fitWidth(); return; }
    if (e.shiftKey && e.code === 'Digit1') { stop(); ed.fitPage(); return; }
    if (e.shiftKey && e.code === 'Digit2') { stop(); ed.fitWidth(); return; }
    if (ctrl && e.shiftKey && ['l', 'e', 'r', 'j'].includes(key)) { stop(); a.setTextProp('textAlign', { l: 'left', e: 'center', r: 'right', j: 'justify' }[key]); return; }
    if (ctrl && key === 'b') { stop(); a.setTextProp('fontWeight', ['bold', 700].includes(a.textValue('fontWeight')) ? 'normal' : 'bold'); return; }
    if (ctrl && key === 'i') { stop(); a.setTextProp('fontStyle', a.textValue('fontStyle') === 'italic' ? 'normal' : 'italic'); return; }
    if (ctrl && key === 'u') { stop(); a.setTextProp('underline', !a.textValue('underline')); return; }

    if (key === 'Delete' || key === 'Backspace') {
      if (ed.selection()) { stop(); a.remove(); }
      return;
    }
    if (key === 'PageDown' || key === 'PageUp') {
      stop();
      const i = ed.pageIndex(ed.visiblePageId || ed.activePageId) + (key === 'PageDown' ? 1 : -1);
      if (ed.pages[i]) ed.setActivePage(ed.pages[i].id, { scroll: true });
      return;
    }
    if (key.startsWith('Arrow') && ed.selection()) {
      stop();
      const d = e.shiftKey ? 10 : 1;
      a.nudge(key === 'ArrowLeft' ? -d : key === 'ArrowRight' ? d : 0, key === 'ArrowUp' ? -d : key === 'ArrowDown' ? d : 0);
      return;
    }
    if (ctrl || e.altKey || e.repeat) return;
    const toolKeys = { v: 'select', l: 'lasso', p: 'pen', h: 'highlighter', e: 'eraser', t: 'text', s: 'shape', k: 'laser' };
    if (toolKeys[key]) { stop(); this.tools.setTool(toolKeys[key]); return; }
    if (key === 'r' || key === 'c') { stop(); this.tools.cfg.shape.kind = key === 'r' ? 'rect' : 'ellipse'; this.tools.setTool('shape'); this.toolCtx.render(); return; }
    if (key === 'i') { stop(); this.insertImageDialog(); return; }
    if (key === 'n') { stop(); a.addSticky(); }
  }

  // ---------- viewport: zoom, pan, drop ----------
  wireViewport() {
    const vp = $('#viewport');
    vp.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * (Math.abs(e.deltaY) < 50 ? 0.01 : 0.0018));
      this.ed.setZoom(this.ed.zoom * factor, { x: e.clientX - r.left, y: e.clientY - r.top });
    }, { passive: false });

    vp.addEventListener('pointerdown', (e) => {
      const pan = e.button === 1 || (e.button === 0 && (this.tools.spaceDown || this.tools.tool === 'hand'));
      if (!pan) return;
      e.preventDefault();
      e.stopPropagation();
      vp.setPointerCapture(e.pointerId);
      document.body.classList.add('panning-active');
      const start = { x: e.clientX, y: e.clientY, sl: vp.scrollLeft, st: vp.scrollTop };
      const move = (ev) => {
        vp.scrollLeft = start.sl - (ev.clientX - start.x);
        vp.scrollTop = start.st - (ev.clientY - start.y);
      };
      const up = () => {
        document.body.classList.remove('panning-active');
        vp.removeEventListener('pointermove', move);
        vp.removeEventListener('pointerup', up);
        vp.removeEventListener('pointercancel', up);
      };
      vp.addEventListener('pointermove', move);
      vp.addEventListener('pointerup', up);
      vp.addEventListener('pointercancel', up);
    }, true);

    // Clicking empty desk space clears the selection.
    vp.addEventListener('pointerdown', (e) => {
      if (e.target === vp || e.target.id === 'pages' || e.target.classList.contains('page-wrap')) this.ed.discardSelection();
    });
  }

  /** Map a client point to {view, x, y} in page coordinates. */
  pagePoint(clientX, clientY) {
    const frame = document.elementsFromPoint(clientX, clientY).map((n) => n.closest?.('.page-frame')).find(Boolean);
    if (!frame) return null;
    const v = this.ed.views.get(frame.dataset.pageId);
    const r = frame.getBoundingClientRect();
    return { view: v, x: (clientX - r.left) / this.ed.zoom, y: (clientY - r.top) / this.ed.zoom };
  }

  wireDragDrop() {
    let overlay = null;
    const showOverlay = (text) => {
      if (!overlay) { overlay = h('<div class="drop-overlay"></div>'); document.body.appendChild(overlay); }
      overlay.textContent = text;
    };
    const hideOverlay = () => { overlay?.remove(); overlay = null; };
    document.addEventListener('dragover', (e) => {
      const types = [...e.dataTransfer.types];
      if (types.includes('application/x-inknote-pages')) return;
      e.preventDefault();
      if (types.includes('Files')) showOverlay(this.home.visible ? 'Drop to open' : 'Drop PDFs to add pages, or images to place them');
    });
    document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) hideOverlay(); });
    document.addEventListener('drop', async (e) => {
      hideOverlay();
      const types = [...e.dataTransfer.types];
      if (types.includes('application/x-inknote-pages')) return;
      e.preventDefault();
      const pt = this.pagePoint(e.clientX, e.clientY);
      const textData = e.dataTransfer.getData('application/x-inknote-text');
      if (textData) {
        const { styleId, text } = JSON.parse(textData);
        const view = pt?.view || await this.ed.ensureMounted(this.ed.activePageId);
        if (!view.fc) await this.ed.ensureMounted(view.page.id);
        this.actions.insertText({ text, style: this.textStyles.get(styleId), at: pt ? { x: pt.x - 40, y: pt.y - 16 } : undefined, view, selectAll: true });
        return;
      }
      const elId = e.dataTransfer.getData('application/x-inknote-element');
      if (elId) {
        const el = (this.settings.elements || []).find((x) => x.id === elId);
        if (el) this.insertElement(el, pt);
        return;
      }
      const files = [...e.dataTransfer.files];
      if (files.length) await this.handleDroppedFiles(files, pt);
    });
  }

  async handleDroppedFiles(files, pt) {
    for (const f of files) {
      const ext = f.name.split('.').pop().toLowerCase();
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (ext === 'inknote') { await this.openBytes(bytes, f.name, window.native.pathForFile(f)); return; }
      if (ext === 'pdf') {
        if (this.home.visible) await this.openBytes(bytes, f.name, null);
        else await this.insertPdf(bytes, f.name);
        continue;
      }
      if (f.type.startsWith('image/')) {
        if (this.home.visible) { await this.imagesToNewNotebook([{ data: bytes, ext, name: f.name }]); continue; }
        const view = pt?.view || null;
        if (view && !view.fc) await this.ed.ensureMounted(view.page.id);
        await this.actions.insertImageBytes(bytes, f.type, { at: pt ? { x: pt.x, y: pt.y } : undefined, view });
      }
    }
  }

  // ---------- status pill ----------
  wireStatus() {
    const input = $('#page-input');
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const i = parseInt(input.value, 10) - 1;
        const p = this.ed.pages[Math.max(0, Math.min(this.ed.pages.length - 1, i))];
        if (p) this.ed.setActivePage(p.id, { scroll: true });
        input.blur();
      }
      if (e.key === 'Escape') input.blur();
    });
    input.addEventListener('focus', () => input.select());
    $('#zoom-label').addEventListener('click', (e) => menu([
      ...[50, 75, 100, 125, 150, 200, 300].map((z) => ({ label: `${z}%`, checked: Math.round(this.ed.zoom * 100) === z, action: () => this.ed.setZoom(z / 100) })),
      '-',
      { label: 'Fit page', key: 'Shift+1', action: () => this.ed.fitPage() },
      { label: 'Fit width', key: 'Shift+2', action: () => this.ed.fitWidth() },
    ], e.currentTarget, { placement: 'above' }));
  }

  wireNative() {
    window.native.on('open-path', (p) => this.openPath(p));
    window.native.on('app:request-close', async () => {
      if (this.audio.rec) await this.audio.stop();
      if (this.ed.dirty) {
        const r = await window.native.confirmUnsaved();
        if (r === 'cancel') return;
        if (r === 'save' && !(await this.save())) return;
      }
      await window.native.clearRecovery();
      window.native.closeConfirmed();
    });
  }

  // ---------- documents ----------
  loadDocument({ title, pages, assets, meta = {}, filePath = null }) {
    this.home.hide();
    this.audio.closePlayer();
    this.ed.load({ title, pages, assets: assets || new Assets(), meta, filePath });
    this.panels.close();
    requestAnimationFrame(() => {
      this.ed.fitWidth(1.15);
      this.ed.viewport.scrollTop = 0;
    });
  }

  newFromTemplate(s) {
    const p = newPage({ size: s.size || 'a4', landscape: !!s.landscape, template: s.template });
    this.loadDocument({ title: s.name === 'Blank pages' ? 'Untitled notebook' : s.name, pages: [p] });
  }

  async confirmDiscard() {
    if (!this.ed.dirty) return true;
    const r = await window.native.confirmUnsaved();
    if (r === 'cancel') return false;
    if (r === 'save') return this.save();
    return true;
  }

  async openDialog(kind = 'open') {
    const files = await window.native.openFiles({ kind: kind === 'notebook' ? 'notebook' : kind === 'pdf' ? 'pdf' : 'open' });
    if (!files.length) return;
    const f = files[0];
    await this.openBytes(new Uint8Array(f.data), f.name, f.path);
  }

  async openPath(p) {
    try {
      const f = await window.native.readFile(p);
      await this.openBytes(new Uint8Array(f.data), f.name, f.path);
    } catch (err) {
      toast(`Could not open ${p.split(/[\\/]/).pop()}: ${err.message || err}`);
    }
  }

  async openBytes(bytes, name, filePath) {
    const ext = name.split('.').pop().toLowerCase();
    if (!(await this.confirmDiscard())) return;
    try {
      if (ext === 'inknote') {
        const doc = await deserialize(bytes);
        this.loadDocument({ ...doc, filePath });
        toast(`Opened ${doc.title}`);
      } else if (ext === 'pdf') {
        const assets = new Assets();
        const { pages, outline } = await this.pdfToPages(assets, bytes);
        this.loadDocument({ title: name.replace(/\.pdf$/i, ''), pages, assets, meta: { outline, source: name } });
        this.ed.setDirty(false);
        toast(`Opened ${pages.length}-page PDF. Save to keep your notes as a notebook.`);
      } else if (MIME_BY_EXT[ext]?.startsWith('image/')) {
        await this.imagesToNewNotebook([{ data: bytes, ext, name }]);
      } else {
        toast('That file type is not supported');
      }
    } catch (err) {
      console.error(err);
      modal({ title: 'Could not open file', body: `<p>${String(err.message || err).replace(/</g, '&lt;')}</p>`, actions: [{ label: 'OK', primary: true }] });
    }
  }

  async pdfToPages(assets, bytes) {
    const assetId = assets.add(bytes, 'application/pdf');
    const sizes = await pdf.pdfPageSizes(assetId, bytes);
    const pages = sizes.map((s, i) => ({ ...newPage({ width: s.width, height: s.height }), pdf: { assetId, pageIndex: i } }));
    const raw = await pdf.pdfOutline(assetId, bytes).catch(() => []);
    const outline = raw.filter((o) => pages[o.pageIndex]).map((o) => ({ title: o.title, pageId: pages[o.pageIndex].id, level: o.level }));
    return { pages, outline };
  }

  async importPdfDialog() {
    const files = await window.native.openFiles({ kind: 'pdf', multi: true, title: 'Insert PDF pages' });
    for (const f of files) await this.insertPdf(new Uint8Array(f.data), f.name);
  }

  async insertPdf(bytes, name) {
    try {
      const { pages, outline } = await this.pdfToPages(this.ed.assets, bytes);
      const at = this.ed.pageIndex(this.ed.visiblePageId || this.ed.activePageId) + 1;
      this.ed.meta.outline = [...(this.ed.meta.outline || []), ...outline];
      this.ed.insertPages(pages, at);
      this.ed.setActivePage(pages[0].id, { scroll: true });
      toast(`Inserted ${pages.length} page${pages.length > 1 ? 's' : ''} from ${name}`, { action: () => this.ed.undo() });
    } catch (err) {
      toast(`Could not read ${name}: ${err.message || err}`);
    }
  }

  async imagePages(files, assets) {
    const pages = [];
    for (const f of files) {
      const mime = MIME_BY_EXT[f.ext] || 'image/png';
      const assetId = assets.add(new Uint8Array(f.data), mime);
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = assets.url(assetId); });
      const width = img.width >= img.height ? 1123 : 794;
      const height = Math.round((img.height / img.width) * width);
      pages.push({ ...newPage({ width, height }), image: { assetId } });
    }
    return pages;
  }

  async imagesToNewNotebook(files) {
    const assets = new Assets();
    const pages = await this.imagePages(files, assets);
    this.loadDocument({ title: files[0].name.replace(/\.[^.]+$/, ''), pages, assets });
  }

  async importImagesAsPages(newNotebook) {
    const files = await window.native.openFiles({ kind: 'images', multi: true, title: 'Choose images' });
    if (!files.length) return;
    if (newNotebook) {
      if (!(await this.confirmDiscard())) return;
      await this.imagesToNewNotebook(files);
      return;
    }
    const pages = await this.imagePages(files, this.ed.assets);
    this.ed.insertPages(pages, this.ed.pageIndex(this.ed.activePageId) + 1);
    this.ed.setActivePage(pages[0].id, { scroll: true });
  }

  async save(as = false) {
    this.ed.finishTextEditing();
    let path = this.ed.filePath;
    if (!path || as) {
      path = await window.native.saveDialog({ kind: 'notebook', defaultName: `${this.ed.title.replace(/[\\/:*?"<>|]/g, '_')}.inknote` });
      if (!path) return false;
    }
    try {
      const data = await serialize({ title: this.ed.title, pages: this.ed.pages, assets: this.ed.assets, meta: this.ed.meta });
      await window.native.writeFile(path, data, true);
      this.ed.filePath = path;
      this.ed.setDirty(false);
      await window.native.clearRecovery();
      toast(`Saved to ${path.split(/[\\/]/).pop()}`);
      return true;
    } catch (err) {
      modal({ title: 'Could not save', body: `<p>${String(err.message || err).replace(/</g, '&lt;')}</p>`, actions: [{ label: 'OK', primary: true }] });
      return false;
    }
  }

  async autosave() {
    if (!this.ed.dirty || this.saving) return;
    if (this.editingText()) return;
    this.saving = true;
    try {
      const data = await serialize({ title: this.ed.title, pages: this.ed.pages, assets: this.ed.assets, meta: this.ed.meta });
      if (this.ed.filePath && this.settings.autosave !== false) {
        await window.native.writeFile(this.ed.filePath, data, true);
        this.ed.setDirty(false);
        await window.native.clearRecovery();
      } else {
        await window.native.writeRecovery(data, { title: this.ed.title, filePath: this.ed.filePath });
      }
    } catch (err) {
      console.warn('autosave failed', err);
    } finally {
      this.saving = false;
    }
  }

  async offerRecovery() {
    const rec = await window.native.readRecovery();
    if (!rec) return false;
    return new Promise((resolve) => {
      const when = new Date(rec.meta.savedAt).toLocaleString();
      modal({
        title: 'Recover unsaved work?',
        body: `<p>InkNote Studio closed before “${String(rec.meta.title || 'Untitled').replace(/</g, '&lt;')}” was saved. A copy from ${when} is available.</p>`,
        actions: [
          { label: 'Discard', action: async () => { await window.native.clearRecovery(); resolve(false); } },
          {
            label: 'Recover',
            primary: true,
            action: async () => {
              const doc = await deserialize(new Uint8Array(rec.data));
              this.loadDocument({ ...doc, filePath: rec.meta.filePath || null });
              this.ed.setDirty(true);
              resolve(true);
            },
          },
        ],
        onClose: (r) => { if (r === null) resolve(false); },
      });
    });
  }

  // ---------- export ----------
  async exportPdf(pageIds, quality, onProgress) {
    this.ed.finishTextEditing();
    const path = await window.native.saveDialog({ kind: 'pdf', defaultName: `${this.ed.title.replace(/[\\/:*?"<>|]/g, '_')}.pdf` });
    if (!path) return false;
    try {
      const bytes = await exporter.exportPdf(this.ed, pageIds, { quality, onProgress });
      await window.native.writeFile(path, bytes);
      toast(`Exported ${pageIds.length} page${pageIds.length > 1 ? 's' : ''} · ${(bytes.length / 1048576).toFixed(1)} MB`);
      return true;
    } catch (err) {
      console.error(err);
      toast(`Export failed: ${err.message || err}`);
      return false;
    }
  }

  async exportPng(pageId) {
    const i = this.ed.pageIndex(pageId);
    const path = await window.native.saveDialog({ kind: 'png', defaultName: `${this.ed.title} - page ${i + 1}.png` });
    if (!path) return;
    const bytes = await exporter.exportPng(this.ed, pageId, 2);
    await window.native.writeFile(path, bytes);
    toast('Page exported as PNG');
  }

  async print() {
    toast('Preparing pages for printing…');
    await exporter.printPages(this.ed);
  }

  // ---------- page helpers ----------
  addPageAt(index) {
    const ref = this.ed.pages[Math.min(index, this.ed.pages.length) - 1] || this.ed.pages[0];
    const p = newPage(ref ? { width: ref.pdf || ref.image ? 794 : ref.width, height: ref.pdf || ref.image ? 1123 : ref.height, template: ref.bg.template, color: ref.bg.color } : {});
    if (ref) p.bg.spacing = ref.bg.spacing;
    this.ed.insertPages([p], index);
    this.ed.setActivePage(p.id);
    requestAnimationFrame(() => this.ed.scrollToPage(p.id));
  }

  deletePages(ids) {
    const n = ids.length;
    this.ed.deletePages(ids);
    toast(n > 1 ? `Deleted ${n} pages` : 'Page deleted', { action: () => this.ed.undo() });
  }

  toggleBookmark(ids) {
    const on = !this.ed.page(ids[0]).bookmark;
    const set = new Set(ids);
    this.ed.setPages(this.ed.pages.map((p) => (set.has(p.id) ? { ...p, bookmark: on } : p)));
  }

  async rotatePages(ids) {
    const next = [];
    for (const p of this.ed.pages) {
      if (!ids.includes(p.id)) { next.push(p); continue; }
      if (p.pdf || p.image) { toast('PDF and image pages cannot be rotated yet'); next.push(p); continue; }
      const W = p.width;
      const H = p.height;
      const data = p.data?.objects?.length ? await exporter.withPageObjects(p, (sc) => {
        for (const o of sc.getObjects()) {
          const c = o.getCenterPoint();
          o.rotate(((o.angle || 0) + 90) % 360);
          o.setPositionByOrigin(new fabric.Point(H - c.y, c.x), 'center', 'center');
        }
        const d = sc.toObject(['id', 'assetId', 'isInk', 'inkType', 'inkPen', 'inkIsPen', 'inkPoints', 'isTape', 'tapeRevealed', 'shapeKind', 'linkPage', 'linkUrl', 'listType', 'audioRef', 'textMark', 'styleId', 'locked', 'name', 'cornerRadius', 'arrowHead']);
        delete d.background;
        return d;
      }) : p.data;
      next.push({ ...p, width: H, height: W, data });
    }
    this.ed.setPages(next);
  }

  followLink(o) {
    if (o.linkPage && this.ed.page(o.linkPage)) this.ed.setActivePage(o.linkPage, { scroll: true });
    else if (o.linkUrl) window.native.openExternal(o.linkUrl);
  }

  async flashRect(pageId, rect) {
    this.ed.setActivePage(pageId);
    const v = this.ed.views.get(pageId);
    if (!v) return;
    const z = this.ed.zoom;
    const vp = this.ed.viewport;
    vp.scrollTop = v.wrap.offsetTop + rect.y * z - vp.clientHeight / 3;
    const mark = h(`<div class="search-flash" style="left:${rect.x * z - 3}px;top:${rect.y * z - 2}px;width:${rect.w * z + 6}px;height:${rect.h * z + 4}px"></div>`);
    v.frame.appendChild(mark);
    setTimeout(() => mark.remove(), 1700);
  }

  // ---------- images ----------
  async insertImageDialog() {
    const files = await window.native.openFiles({ kind: 'images', multi: true, title: 'Insert images' });
    for (const f of files) await this.actions.insertImageBytes(new Uint8Array(f.data), MIME_BY_EXT[f.ext] || 'image/png');
  }

  async replaceImageDialog() {
    const files = await window.native.openFiles({ kind: 'images', title: 'Replace image' });
    if (files[0]) await this.actions.replaceImage(new Uint8Array(files[0].data), MIME_BY_EXT[files[0].ext] || 'image/png');
  }

  async screenshotSelection() {
    const s = this.ed.selection();
    if (!s) return;
    const url = s.object.toDataURL({ format: 'png', multiplier: 3 / this.ed.zoom });
    const bytes = Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0));
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([bytes], { type: 'image/png' }) })]);
    } catch { /* clipboard unavailable */ }
    const path = await window.native.saveDialog({ kind: 'png', defaultName: 'Selection.png' });
    if (path) await window.native.writeFile(path, bytes);
    toast(path ? 'Image saved and copied to the clipboard' : 'Image copied to the clipboard');
  }

  // ---------- elements library ----------
  async saveAsElement() {
    const s = this.ed.selection();
    if (!s) { toast('Select something first'); return; }
    const name = await prompt('Add to elements', s.objects.length > 1 ? 'Group' : 'Element', { label: 'Name' });
    if (name === null) return;
    await this.saveElementFromObjects(s.objects, name || 'Element', s.object);
    toast(`Added “${name || 'Element'}” to Elements`);
  }

  async saveElementFromObjects(objects, name, displayObj) {
    const keep = ['assetId', 'isInk', 'inkType', 'inkPen', 'inkIsPen', 'inkPoints', 'shapeKind'];
    let node;
    if (displayObj?.type === 'activeSelection') {
      const sel = await new Promise((res) => displayObj.clone(res, keep));
      node = new fabric.Group(sel.getObjects());
    } else if (objects.length === 1) {
      node = await new Promise((res) => objects[0].clone(res, keep));
    } else {
      node = new fabric.Group(objects);
    }
    const json = node.toObject(['assetId', 'isInk', 'inkType', 'inkPen', 'inkIsPen', 'inkPoints', 'shapeKind']);
    const embed = (o) => {
      if (o.type === 'image' && o.assetId) {
        const a = this.ed.assets.get(o.assetId);
        if (a) {
          let bin = '';
          for (let i = 0; i < a.bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, a.bytes.subarray(i, i + 0x8000));
          o.src = `data:${a.mime};base64,${btoa(bin)}`;
        }
        delete o.assetId;
      }
      (o.objects || []).forEach(embed);
    };
    embed(json);
    const thumb = node.toDataURL({ format: 'png', multiplier: Math.min(2, 160 / Math.max(node.getScaledWidth(), node.getScaledHeight(), 1)) });
    const el = { id: uid('el'), name, json, thumb };
    await this.saveSettings({ elements: [...(this.settings.elements || []), el] });
    if (this.panels.current === 'elements') this.panels.render();
  }

  async insertElement(el, pt) {
    if (!el) return;
    const json = JSON.parse(JSON.stringify(el.json));
    const detach = (o) => {
      if (o.type === 'image' && o.src?.startsWith('data:')) {
        const [meta, b64] = o.src.split(',');
        const mime = meta.slice(5).split(';')[0];
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        o.assetId = this.ed.assets.add(bytes, mime);
        o.src = this.ed.assets.url(o.assetId);
      }
      (o.objects || []).forEach(detach);
    };
    detach(json);
    const view = pt?.view || await this.ed.ensureMounted(this.ed.activePageId);
    if (!view.fc) await this.ed.ensureMounted(view.page.id);
    fabric.util.enlivenObjects([json], ([obj]) => {
      const page = view.page;
      const w = obj.getScaledWidth();
      const hh = obj.getScaledHeight();
      const c = pt || this.ed.visibleCenter(page.id);
      const x = c.x - w / 2;
      const y = c.y - hh / 2;
      obj.set({ left: x, top: y, id: uid('ob') });
      this.tools.setTool('select');
      view.fc.add(obj);
      view.fc.setActiveObject(obj);
      view.fc.requestRenderAll();
    });
  }

  async saveTextStyleFromSelection() {
    const st = this.actions.styleFromSelection();
    if (!st) { toast('Select a text box first'); return; }
    const name = await prompt('Save text style', `${st.fontFamily} ${Math.round(st.fontSize)}`, { label: 'Style name', okLabel: 'Save style' });
    if (!name) return;
    const created = this.textStyles.add(name, st);
    const o = this.actions.textObjects()[0];
    if (o) o.styleId = created.id;
    toast(`Saved style “${name}”`);
  }

  // ---------- document info used by pickers ----------
  docColors() {
    const set = new Set();
    for (const p of this.ed.pages) {
      for (const o of p.data?.objects || []) {
        for (const c of [o.fill, o.stroke]) if (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)) set.add(c.toLowerCase());
      }
      if (set.size > 24) break;
    }
    return [...set];
  }

  docFonts() {
    const set = new Set();
    for (const p of this.ed.pages) for (const o of p.data?.objects || []) if (o.fontFamily) set.add(o.fontFamily);
    return [...set];
  }
}

const app = new App();
window.app = app;
app.init().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;inset:auto 16px 16px;z-index:999;background:#fff;color:#c42b1c;padding:12px;border-radius:8px;box-shadow:0 8px 16px rgba(0,0,0,.2);white-space:pre-wrap">Startup error: ${String(err.stack || err).replace(/</g, '&lt;')}</pre>`);
});
