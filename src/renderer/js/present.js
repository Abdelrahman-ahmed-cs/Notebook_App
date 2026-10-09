// Full-screen presentation with a laser pointer.
import { renderPage } from './exporter.js';

export class Presenter {
  constructor(app) {
    this.app = app;
    this.ed = app.ed;
    this.el = document.getElementById('present');
    this.onKey = (e) => this.key(e);
  }

  async start(pageId = this.ed.visiblePageId || this.ed.activePageId) {
    this.index = Math.max(0, this.ed.pageIndex(pageId));
    this.el.hidden = false;
    this.el.innerHTML = '<canvas class="slide"></canvas><canvas class="laser" style="position:fixed;inset:0"></canvas><div class="pres-hud"></div>';
    this.slide = this.el.querySelector('.slide');
    this.laser = this.el.querySelector('.laser');
    this.hud = this.el.querySelector('.pres-hud');
    this.trail = [];
    try { await document.documentElement.requestFullscreen(); } catch { /* windowed is fine */ }
    document.addEventListener('keydown', this.onKey, true);
    this.el.onpointermove = (e) => { this.trail.push({ x: e.clientX, y: e.clientY, t: performance.now() }); this.loop(); };
    this.el.onwheel = (e) => this.go(this.index + (e.deltaY > 0 ? 1 : -1));
    this.el.onclick = (e) => { if (e.detail === 1) this.go(this.index + 1); };
    this.el.oncontextmenu = (e) => { e.preventDefault(); this.go(this.index - 1); };
    document.onfullscreenchange = () => { if (!document.fullscreenElement && !this.el.hidden) this.stop(); };
    setTimeout(() => this.draw(), 120);
  }

  async draw() {
    const page = this.ed.pages[this.index];
    if (!page) return;
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.min(innerWidth / page.width, innerHeight / page.height);
    const token = (this.token = Symbol('slide'));
    const c = await renderPage(this.ed, page, scale * dpr);
    if (token !== this.token) return;
    this.slide.width = c.width;
    this.slide.height = c.height;
    this.slide.style.width = `${page.width * scale}px`;
    this.slide.style.height = `${page.height * scale}px`;
    this.slide.getContext('2d').drawImage(c, 0, 0);
    this.laser.width = innerWidth * dpr;
    this.laser.height = innerHeight * dpr;
    this.laser.style.width = `${innerWidth}px`;
    this.laser.style.height = `${innerHeight}px`;
    this.hud.textContent = `${this.index + 1} / ${this.ed.pages.length} · Esc to exit`;
  }

  loop() {
    if (this.raf) return;
    const step = () => {
      const ctx = this.laser.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const now = performance.now();
      this.trail = this.trail.filter((p) => now - p.t < 500);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      const color = this.app.tools.cfg.laser.color;
      ctx.lineCap = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      for (let i = 1; i < this.trail.length; i++) {
        const a = this.trail[i - 1];
        const b = this.trail[i];
        const life = 1 - (now - b.t) / 500;
        ctx.globalAlpha = life;
        ctx.strokeStyle = color;
        ctx.lineWidth = 6 * life + 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      const last = this.trail[this.trail.length - 1];
      if (last) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(last.x, last.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (this.trail.length) this.raf = requestAnimationFrame(step);
      else { this.raf = null; ctx.clearRect(0, 0, innerWidth, innerHeight); }
    };
    this.raf = requestAnimationFrame(step);
  }

  go(i) {
    if (i < 0 || i >= this.ed.pages.length || i === this.index) return;
    this.index = i;
    this.draw();
  }

  key(e) {
    e.stopPropagation();
    e.preventDefault();
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) this.go(this.index + 1);
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) this.go(this.index - 1);
    else if (e.key === 'Home') this.go(0);
    else if (e.key === 'End') this.go(this.ed.pages.length - 1);
    else if (e.key === 'Escape') this.stop();
  }

  stop() {
    document.removeEventListener('keydown', this.onKey, true);
    document.onfullscreenchange = null;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    this.el.hidden = true;
    this.el.innerHTML = '';
    const page = this.ed.pages[this.index];
    if (page) this.ed.setActivePage(page.id, { scroll: true });
  }
}
