// Small UI toolkit: flyouts, menus, modals, toasts, colour picker, sliders.
import { icon, hydrateIcons } from './icons.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  hydrateIcons(t.content);
  return t.content.firstElementChild;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- flyouts ----------
let openFlyouts = [];

export function closeFlyouts(keep) {
  openFlyouts = openFlyouts.filter((f) => {
    if (keep && (f.el === keep || f.el.contains(keep))) return true;
    f.el.remove();
    f.onClose?.();
    return false;
  });
}

export function hasFlyout() { return openFlyouts.length > 0; }

/** Show an element anchored to a target element or {x,y} point. */
export function flyout(content, anchor, { placement = 'below', onClose, className = '', keepOthers = false } = {}) {
  if (!keepOthers) closeFlyouts();
  const el = typeof content === 'string' ? h(content) : content;
  el.classList.add('flyout');
  if (className) className.split(' ').forEach((c) => el.classList.add(c));
  document.getElementById('flyouts').appendChild(el);
  const rec = { el, onClose, anchor };
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); closeFlyouts(); }
  });
  openFlyouts.push(rec);
  position(el, anchor, placement);
  setTimeout(() => el.querySelector('input[autofocus], .input[data-focus]')?.focus(), 0);
  return el;
}

function position(el, anchor, placement) {
  const r = anchor instanceof Element ? anchor.getBoundingClientRect() : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y, width: 0, height: 0 };
  const w = el.offsetWidth;
  const hgt = el.offsetHeight;
  let x = placement === 'right' ? r.right + 4 : r.left;
  let y = placement === 'right' ? r.top : placement === 'above' ? r.top - hgt - 6 : r.bottom + 6;
  if (placement === 'center-below') x = r.left + r.width / 2 - w / 2;
  x = Math.max(8, Math.min(x, innerWidth - w - 8));
  if (y + hgt > innerHeight - 8) y = Math.max(8, (anchor instanceof Element ? r.top - hgt - 6 : innerHeight - hgt - 8));
  y = Math.max(8, y);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

document.addEventListener('pointerdown', (e) => {
  if (!openFlyouts.length) return;
  if (e.target.closest('.flyout')) return;
  if (openFlyouts.some((f) => f.anchor instanceof Element && f.anchor.contains(e.target))) return;
  closeFlyouts();
}, true);

/**
 * Menu flyout. items: [{label, icon, key, action, disabled, danger, checked, submenu}] | '-' | {head}
 */
export function menu(items, anchor, opts = {}) {
  const el = document.createElement('div');
  el.setAttribute('role', 'menu');
  for (const it of items) {
    if (!it) continue;
    if (it === '-') { el.appendChild(h('<div class="menu-sep"></div>')); continue; }
    if (it.head) { el.appendChild(h(`<div class="menu-head">${esc(it.head)}</div>`)); continue; }
    const b = h(`<button class="menu-item${it.danger ? ' danger' : ''}${it.checked ? ' checked' : ''}" role="menuitem">
      <span class="mi-icon">${it.icon ? icon(it.icon, 16) : ''}</span><span class="mi-label">${esc(it.label)}</span>
      ${it.key ? `<span class="mi-key">${esc(it.key)}</span>` : ''}${it.submenu ? icon('chevronRight', 14) : ''}</button>`);
    b.disabled = !!it.disabled;
    b.addEventListener('click', (e) => {
      if (it.submenu) {
        e.stopPropagation();
        // Close sibling submenus, keep this menu open.
        const mine = openFlyouts.findIndex((f) => f.el === el);
        openFlyouts.slice(mine + 1).forEach((f) => f.el.remove());
        openFlyouts = openFlyouts.slice(0, mine + 1);
        Promise.resolve(typeof it.submenu === 'function' ? it.submenu() : it.submenu)
          .then((list) => menu(list, b, { placement: 'right', keepOthers: true }));
        return;
      }
      closeFlyouts();
      it.action?.();
    });
    el.appendChild(b);
  }
  el.addEventListener('keydown', (e) => {
    const btns = $$('.menu-item:not(:disabled)', el);
    const i = btns.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length]?.focus(); }
    if (e.key === 'Escape') closeFlyouts();
  });
  return flyout(el, anchor, opts);
}

// ---------- toasts ----------
export function toast(msg, { action, actionLabel = 'Undo', timeout = 3200 } = {}) {
  const host = document.getElementById('toasts');
  const t = h(`<div class="toast"><span>${esc(msg)}</span></div>`);
  if (action) {
    const b = h(`<button>${esc(actionLabel)}</button>`);
    b.addEventListener('click', () => { action(); t.remove(); });
    t.appendChild(b);
  }
  host.appendChild(t);
  while (host.children.length > 3) host.firstElementChild.remove();
  setTimeout(() => t.remove(), timeout);
}

// ---------- modals ----------
export function modal({ title, body, actions = [], wide = false, onClose }) {
  closeFlyouts();
  const root = document.getElementById('modal-root');
  const back = h(`<div class="modal-backdrop"><div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true">
    <div class="modal-body">${title ? `<h2>${esc(title)}</h2>` : ''}</div><div class="modal-foot"></div></div></div>`);
  const bodyEl = back.querySelector('.modal-body');
  if (typeof body === 'string') bodyEl.insertAdjacentHTML('beforeend', body);
  else if (body) bodyEl.appendChild(body);
  hydrateIcons(bodyEl);
  const foot = back.querySelector('.modal-foot');
  let closed = false;
  const close = (result) => {
    if (closed) return;
    closed = true;
    back.remove();
    document.removeEventListener('keydown', onKey, true);
    onClose?.(result);
  };
  for (const a of actions) {
    const b = h(`<button class="btn${a.primary ? ' primary' : ''}${a.danger ? ' danger' : ''}">${esc(a.label)}</button>`);
    b.addEventListener('click', async () => {
      if (a.action) {
        const r = await a.action(bodyEl);
        if (r === false) return;
      }
      close(a.value ?? a.label);
    });
    foot.appendChild(b);
  }
  if (!actions.length) foot.remove();
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(null); }
    if (e.key === 'Enter' && !e.target.matches('textarea')) {
      const primary = foot.querySelector('.btn.primary');
      if (primary && !e.target.matches('button')) { e.preventDefault(); primary.click(); }
    }
  };
  document.addEventListener('keydown', onKey, true);
  back.addEventListener('pointerdown', (e) => { if (e.target === back) close(null); });
  root.appendChild(back);
  setTimeout(() => (bodyEl.querySelector('[autofocus]') || foot.querySelector('.btn.primary'))?.focus(), 30);
  return { el: bodyEl, close };
}

export function prompt(title, value = '', { label = '', placeholder = '', okLabel = 'OK' } = {}) {
  return new Promise((resolve) => {
    let val = null;
    modal({
      title,
      body: `<div class="field">${label ? `<label>${esc(label)}</label>` : ''}<input class="input" autofocus value="${esc(value)}" placeholder="${esc(placeholder)}"></div>`,
      actions: [
        { label: 'Cancel' },
        { label: okLabel, primary: true, action: (b) => { val = b.querySelector('input').value; } },
      ],
      onClose: () => resolve(val),
    });
  });
}

export function confirmDialog(title, message, { okLabel = 'OK', danger = false } = {}) {
  return new Promise((resolve) => {
    let ok = false;
    modal({
      title,
      body: `<p>${esc(message)}</p>`,
      actions: [{ label: 'Cancel' }, { label: okLabel, primary: !danger, danger, action: () => { ok = true; } }],
      onClose: () => resolve(ok),
    });
  });
}

// ---------- sliders ----------
export function bindRange(input, onInput) {
  const paint = () => {
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    input.style.setProperty('--p', `${((Number(input.value) - min) / (max - min)) * 100}%`);
  };
  paint();
  input.addEventListener('input', () => { paint(); onInput(Number(input.value)); });
  return paint;
}

// ---------- colour picker ----------
export const PALETTE = [
  '#000000', '#1f1f1f', '#4d4d4d', '#7a7a7a', '#a8a8a8', '#d4d4d4', '#ededed', '#ffffff',
  '#7f1d1d', '#d92d20', '#f97066', '#ea580c', '#fb923c', '#f5b301', '#ffe45c', '#fef3a2',
  '#14532d', '#15803d', '#4ade80', '#0f766e', '#2dd4bf', '#0e7490', '#38bdf8', '#9ccbff',
  '#1e3a8a', '#1d4ed8', '#60a5fa', '#5b21b6', '#8b5cf6', '#be185d', '#ec4899', '#ffa3c7',
];

/**
 * Colour flyout. opts: { value, onPick(color), allowNone, docColors }
 */
export function colorPicker(anchor, { value, onPick, allowNone = false, docColors = [], title = 'Colour' } = {}) {
  const el = h(`<div class="panel">
    <div class="fly-title">${esc(title)}</div>
    ${docColors.length ? `<div class="field"><div class="field-label">Document colours</div><div class="palette doc"></div></div>` : ''}
    <div class="field"><div class="field-label">Default colours</div><div class="palette def"></div></div>
    <div class="hexrow"><input type="color" aria-label="Custom colour"><input class="input hex" maxlength="7" spellcheck="false" aria-label="Hex colour">
      ${'EyeDropper' in window ? `<button class="ibtn dropper" title="Pick a colour from the screen">${icon('dropper', 18)}</button>` : ''}</div>
  </div>`);
  const norm = (c) => (c || '').toLowerCase();
  const fill = (host, colors) => {
    if (allowNone && host.classList.contains('def')) {
      const b = h('<button class="none" title="No colour"></button>');
      if (!value || value === 'transparent' || /^#[0-9a-f]{6}00$/i.test(value)) b.classList.add('on');
      b.addEventListener('click', () => { onPick('transparent'); closeFlyouts(); });
      host.appendChild(b);
    }
    for (const c of colors) {
      const b = h(`<button title="${c}" style="--c:${c}"></button>`);
      if (norm(c) === norm(value)) b.classList.add('on');
      b.addEventListener('click', () => { onPick(c); closeFlyouts(); });
      host.appendChild(b);
    }
  };
  if (docColors.length) fill(el.querySelector('.palette.doc'), docColors.slice(0, 16));
  fill(el.querySelector('.palette.def'), PALETTE);
  const native = el.querySelector('input[type=color]');
  const hex = el.querySelector('.hex');
  const v = /^#[0-9a-f]{6}/i.test(value || '') ? value.slice(0, 7) : '#000000';
  native.value = v;
  hex.value = v.toUpperCase();
  native.addEventListener('input', () => { hex.value = native.value.toUpperCase(); onPick(native.value); });
  hex.addEventListener('change', () => {
    let c = hex.value.trim();
    if (!c.startsWith('#')) c = `#${c}`;
    if (/^#[0-9a-f]{6}$/i.test(c)) { native.value = c; onPick(c.toLowerCase()); }
  });
  el.querySelector('.dropper')?.addEventListener('click', async () => {
    try {
      const r = await new window.EyeDropper().open();
      onPick(r.sRGBHex);
      closeFlyouts();
    } catch { /* cancelled */ }
  });
  return flyout(el, anchor);
}

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
