// Start screen: new notebook templates, open PDF / notebook, recent files.
import { h, esc } from './ui.js';
import { icon } from './icons.js';
import { templateThumb } from './dialogs.js';

const STARTERS = [
  { template: 'lined', name: 'Ruled notebook', desc: 'A4 · lined' },
  { template: 'grid', name: 'Grid notebook', desc: 'A4 · squared' },
  { template: 'dotted', name: 'Dot journal', desc: 'A4 · dot grid' },
  { template: 'cornell', name: 'Cornell notes', desc: 'Cue column + summary' },
  { template: 'blank', name: 'Blank pages', desc: 'A4 · plain' },
  { template: 'blank', name: 'Slides', desc: '16:9 canvas', size: 'widescreen', landscape: true },
];

export class Home {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('home');
  }

  async show() {
    const recent = await window.native.recentFiles().catch(() => []);
    this.el.innerHTML = '';
    const inner = h(`<div class="home-inner">
      <h1>Start a notebook</h1>
      <p class="sub">Write by hand, annotate PDFs and design pages. Everything stays on this PC.</p>
      <div class="start-row actions"></div>
      <h2>New from a template</h2>
      <div class="start-row templates"></div>
      <h2>Recent</h2>
      <div class="recent-list"></div>
      <div class="home-foot"><span>Drop a PDF or image anywhere to open it</span><span>Ctrl+/ shows every shortcut</span></div>
    </div>`);
    const actions = inner.querySelector('.actions');
    const action = (ic, name, desc, fn) => {
      const b = h(`<button class="start-card action"><div class="sc-art">${icon(ic, 32)}</div><div class="sc-name">${esc(name)}</div><div class="sc-desc">${esc(desc)}</div></button>`);
      b.addEventListener('click', fn);
      actions.appendChild(b);
    };
    action('pdf', 'Open a PDF', 'Annotate and fill in', () => this.app.openDialog('pdf'));
    action('open', 'Open notebook', '.inknote files', () => this.app.openDialog('notebook'));
    action('newDoc', 'Custom notebook…', 'Size, paper and pages', () => this.app.dialogs.newNotebook());
    action('image', 'Images to pages', 'Scans, photos, slides', () => this.app.importImagesAsPages(true));

    const tpl = inner.querySelector('.templates');
    for (const s of STARTERS) {
      const b = h(`<button class="start-card"><div class="sc-art"></div><div class="sc-name">${esc(s.name)}</div><div class="sc-desc">${esc(s.desc)}</div></button>`);
      const art = b.querySelector('.sc-art');
      const c = templateThumb(s.template, '#ffffff', 150, s.landscape ? 84 : 200);
      if (s.landscape) { art.style.aspectRatio = '16 / 9'; art.style.alignSelf = 'start'; }
      art.appendChild(c);
      b.addEventListener('click', () => this.app.newFromTemplate(s));
      tpl.appendChild(b);
    }

    const list = inner.querySelector('.recent-list');
    if (!recent.length) list.appendChild(h('<p class="muted">Notebooks you save or open will appear here.</p>'));
    for (const p of recent) {
      const name = p.split(/[\\/]/).pop();
      const b = h(`<button class="recent-item">${icon('page', 20)}<span class="rn">${esc(name.replace(/\.inknote$/i, ''))}</span><span class="rpath">${esc(p)}</span></button>`);
      b.addEventListener('click', () => this.app.openPath(p));
      list.appendChild(b);
    }
    this.el.appendChild(inner);
    this.el.hidden = false;
  }

  hide() { this.el.hidden = true; }
  get visible() { return !this.el.hidden; }
}
