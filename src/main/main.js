'use strict';

const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, net, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { execFile } = require('child_process');

const APP_EXT = 'inknote';
const RENDERER_DIR = path.join(__dirname, '..', 'renderer');
const isMac = process.platform === 'darwin';

// The renderer is served from app://ui/ so ES modules, workers and fetch behave
// like a normal secure origin while everything stays local and offline.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

let mainWindow = null;
let pendingOpenPath = null;
let allowClose = false;

// ---------- settings (styles, pen presets, recent files, preferences) ----------
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(data) {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  const tmp = settingsFile() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, settingsFile());
}

function addRecent(filePath) {
  const s = readSettings();
  const list = (s.recentFiles || []).filter((p) => p !== filePath);
  list.unshift(filePath);
  s.recentFiles = list.slice(0, 10);
  writeSettings(s);
  if (process.platform === 'win32') app.addRecentDocument(filePath);
}

// ---------- system fonts ----------
function listFontsWindows() {
  const script =
    "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;" +
    'Add-Type -AssemblyName PresentationCore;' +
    '[Windows.Media.Fonts]::SystemFontFamilies | ForEach-Object { $_.Source }';
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
      { maxBuffer: 1024 * 1024 * 16, windowsHide: true },
      (err, stdout) => resolve(err ? [] : stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)));
  });
}

function listFontsUnix() {
  return new Promise((resolve) => {
    execFile('fc-list', [':', 'family'], { maxBuffer: 1024 * 1024 * 16 }, (err, stdout) => {
      if (err) return resolve([]);
      resolve(stdout.split('\n').map((l) => l.split(',')[0].trim()).filter(Boolean));
    });
  });
}

async function listSystemFonts() {
  const fonts = process.platform === 'win32' ? await listFontsWindows() : await listFontsUnix();
  return [...new Set(fonts)].sort((a, b) => a.localeCompare(b));
}

// ---------- window ----------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: 'InkNote Studio',
    backgroundColor: '#f3f3f3',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#f3f3f3', symbolColor: '#1b1b1b', height: 44 },
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.loadURL('app://ui/index.html');

  // Never navigate away or open popups inside the app window.
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://')) e.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (e) => {
    if (allowClose) return;
    e.preventDefault();
    mainWindow.webContents.send('app:request-close');
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function send(channel, ...args) {
  if (mainWindow) mainWindow.webContents.send(channel, ...args);
}

// ---------- IPC ----------
const fileFilters = {
  open: [
    { name: 'All supported', extensions: [APP_EXT, 'pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] },
    { name: 'InkNote Notebook', extensions: [APP_EXT] },
    { name: 'PDF', extensions: ['pdf'] },
    { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] },
  ],
  pdf: [{ name: 'PDF', extensions: ['pdf'] }],
  images: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'] }],
  notebook: [{ name: 'InkNote Notebook', extensions: [APP_EXT] }],
  png: [{ name: 'PNG Image', extensions: ['png'] }],
};

function readFileForRenderer(p) {
  const data = fs.readFileSync(p);
  return { path: p, name: path.basename(p), ext: path.extname(p).slice(1).toLowerCase(), data };
}

function registerIpc() {
  ipcMain.handle('dialog:open', async (_e, { kind = 'open', multi = false, title } = {}) => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title,
      filters: fileFilters[kind] || fileFilters.open,
      properties: multi ? ['openFile', 'multiSelections'] : ['openFile'],
    });
    if (res.canceled) return [];
    return res.filePaths.map(readFileForRenderer);
  });

  ipcMain.handle('file:read', (_e, p) => readFileForRenderer(p));

  ipcMain.handle('dialog:save', async (_e, { kind = 'notebook', defaultName = 'Untitled' } = {}) => {
    const res = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: fileFilters[kind] || fileFilters.notebook,
    });
    return res.canceled ? null : res.filePath;
  });

  ipcMain.handle('file:write', (_e, { path: p, data, isNotebook }) => {
    const tmp = p + '.saving';
    fs.writeFileSync(tmp, Buffer.from(data));
    fs.renameSync(tmp, p);
    if (isNotebook) addRecent(p);
    return true;
  });

  ipcMain.handle('fonts:list', () => listSystemFonts());
  ipcMain.handle('settings:get', () => readSettings());
  ipcMain.handle('settings:set', (_e, patch) => {
    const s = { ...readSettings(), ...patch };
    writeSettings(s);
    return s;
  });
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), platform: process.platform }));

  ipcMain.handle('dialog:confirm-unsaved', async () => {
    const res = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      title: 'Unsaved changes',
      message: 'Do you want to save the changes to this notebook?',
    });
    return ['save', 'discard', 'cancel'][res.response];
  });

  ipcMain.on('app:close-confirmed', () => {
    allowClose = true;
    if (mainWindow) mainWindow.close();
  });

  ipcMain.on('app:set-title', (_e, title) => {
    if (mainWindow) mainWindow.setTitle(title);
  });

  ipcMain.handle('app:pending-open', () => {
    const p = pendingOpenPath;
    pendingOpenPath = null;
    return p;
  });

  ipcMain.handle('recent:list', () => (readSettings().recentFiles || []).filter((p) => fs.existsSync(p)));

  ipcMain.on('app:theme', (_e, dark) => {
    if (!mainWindow || process.platform === 'darwin') return;
    try {
      mainWindow.setTitleBarOverlay(dark
        ? { color: '#202020', symbolColor: '#ffffff', height: 44 }
        : { color: '#f3f3f3', symbolColor: '#1b1b1b', height: 44 });
    } catch { /* overlay unsupported on this platform */ }
    mainWindow.setBackgroundColor(dark ? '#202020' : '#f3f3f3');
  });

  // Crash recovery: the renderer periodically mirrors unsaved work here.
  const recoveryFile = () => path.join(app.getPath('userData'), 'recovery.inknote');
  const recoveryMeta = () => path.join(app.getPath('userData'), 'recovery.json');
  ipcMain.handle('recovery:write', (_e, { data, meta }) => {
    fs.writeFileSync(recoveryFile(), Buffer.from(data));
    fs.writeFileSync(recoveryMeta(), JSON.stringify({ ...meta, savedAt: new Date().toISOString() }));
    return true;
  });
  ipcMain.handle('recovery:read', () => {
    try {
      return { data: fs.readFileSync(recoveryFile()), meta: JSON.parse(fs.readFileSync(recoveryMeta(), 'utf8')) };
    } catch {
      return null;
    }
  });
  ipcMain.handle('recovery:clear', () => {
    for (const f of [recoveryFile(), recoveryMeta()]) { try { fs.unlinkSync(f); } catch { /* none */ } }
    return true;
  });

  ipcMain.on('app:devtools', () => mainWindow && mainWindow.webContents.toggleDevTools());
  ipcMain.on('app:fullscreen', () => mainWindow && mainWindow.setFullScreen(!mainWindow.isFullScreen()));
  ipcMain.on('app:open-external', (_e, url) => {
    if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url);
  });

  ipcMain.handle('app:print', () => new Promise((resolve) => {
    mainWindow.webContents.print({ printBackground: true }, (ok, reason) => resolve({ ok, reason }));
  }));
}

function fileArg(argv) {
  return argv.slice(1).find((a) => /\.(inknote|pdf|png|jpe?g|webp)$/i.test(a) && fs.existsSync(a)) || null;
}

// ---------- lifecycle ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const p = fileArg(argv);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (p) send('open-path', p);
    }
  });

  app.on('open-file', (e, p) => {
    e.preventDefault();
    if (mainWindow) send('open-path', p);
    else pendingOpenPath = p;
  });

  app.whenReady().then(() => {
    pendingOpenPath = pendingOpenPath || fileArg(process.argv);

    protocol.handle('app', (req) => {
      const { pathname } = new URL(req.url);
      const rel = decodeURIComponent(pathname).replace(/^\/+/, '');
      const target = path.normalize(path.join(RENDERER_DIR, rel));
      if (!target.startsWith(RENDERER_DIR)) return new Response('Forbidden', { status: 403 });
      return net.fetch(pathToFileURL(target).toString());
    });

    // Allow the renderer to enumerate locally installed fonts and use the clipboard.
    const allowed = new Set(['local-fonts', 'media', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen']);
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(allowed.has(permission)));
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed.has(permission));

    // Block any network request leaving the machine: the app is fully offline.
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
      (_details, cb) => cb({ cancel: true }));

    registerIpc();
    Menu.setApplicationMenu(null);
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
