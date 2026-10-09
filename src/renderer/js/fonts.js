// System font discovery and saved text styles.
import { BUILTIN_STYLES } from './actions.js';
import { uid } from './doc.js';

const FALLBACK = ['Segoe UI', 'Arial', 'Calibri', 'Cambria', 'Candara', 'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel',
  'Courier New', 'Georgia', 'Ink Free', 'Segoe Print', 'Segoe Script', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'];

let cache = null;

/** Installed font families: Local Font Access API first, then the OS list from the main process. */
export async function systemFonts() {
  if (cache) return cache;
  let families = [];
  try {
    if (window.queryLocalFonts) {
      const fonts = await window.queryLocalFonts();
      families = [...new Set(fonts.map((f) => f.family))];
    }
  } catch { /* permission denied or unsupported */ }
  if (families.length < 5) {
    try { families = await window.native.listFonts(); } catch { families = []; }
  }
  if (!families.length) families = FALLBACK;
  families = families.filter((f) => f && !f.startsWith('.') && !/^(Marlett|Webdings|Wingdings.*|Symbol|MT Extra|Segoe (MDL2|Fluent) Assets|HoloLens MDL2 Assets)$/i.test(f));
  cache = [...new Set(families)].sort((a, b) => a.localeCompare(b));
  return cache;
}

export class TextStyles {
  constructor(app) {
    this.app = app;
    this.user = app.settings.textStyles || [];
    this.defaultId = app.settings.defaultTextStyle || 'body';
    this.recentFonts = app.settings.recentFonts || [];
  }

  all() { return [...BUILTIN_STYLES.map((b) => ({ ...b, ...(this.app.settings.builtinOverrides?.[b.id] || {}) })), ...this.user]; }
  get(id) { return this.all().find((s) => s.id === id); }
  defaultStyle() { return this.get(this.defaultId) || BUILTIN_STYLES[3]; }

  save() {
    this.app.saveSettings({ textStyles: this.user, defaultTextStyle: this.defaultId, recentFonts: this.recentFonts });
    this.app.ed.emit('stylesChanged');
  }

  add(name, props) {
    const st = { id: uid('ts'), name, ...props };
    this.user.push(st);
    this.save();
    return st;
  }

  update(id, props) {
    const i = this.user.findIndex((s) => s.id === id);
    if (i >= 0) this.user[i] = { ...this.user[i], ...props };
    else {
      // Redefining a built-in style keeps its name and stores an override.
      const o = { ...(this.app.settings.builtinOverrides || {}) };
      o[id] = props;
      this.app.saveSettings({ builtinOverrides: o });
    }
    this.save();
  }

  rename(id, name) { this.update(id, { name }); }

  remove(id) {
    this.user = this.user.filter((s) => s.id !== id);
    if (this.defaultId === id) this.defaultId = 'body';
    this.save();
  }

  setDefault(id) { this.defaultId = id; this.save(); }

  useFont(f) {
    this.recentFonts = [f, ...this.recentFonts.filter((x) => x !== f)].slice(0, 6);
    this.save();
  }
}
