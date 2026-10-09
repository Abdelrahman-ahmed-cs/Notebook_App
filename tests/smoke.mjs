// End-to-end smoke test. Launches the app (dev build, or the packaged exe via APP_EXE),
// exercises ink, text, shapes, images, PDF import/export and save/reload, and fails on
// any page error.
import { _electron as electron } from 'playwright-core';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const exe = process.env.APP_EXE ? path.resolve(root, process.env.APP_EXE) : null;
const require = (await import('module')).createRequire(import.meta.url);
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'inknote-smoke-'));

const app = await electron.launch(exe
  ? { executablePath: exe, args: [`--user-data-dir=${userData}`] }
  : { executablePath: require('electron'), args: [root, '--no-sandbox', `--user-data-dir=${userData}`] });

const win = await app.firstWindow();
const errors = [];
win.on('pageerror', (e) => errors.push(e.stack || e.message));
win.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const check = (cond, msg) => { if (!cond) { errors.push(`check failed: ${msg}`); console.error(`✗ ${msg}`); } else console.log(`✓ ${msg}`); };

await win.waitForSelector('.start-card', { timeout: 30000 });
await win.click('.start-card:not(.action) >> nth=0');
await win.waitForSelector('.page-frame .canvas-container', { timeout: 15000 });
const b = await win.locator('.page-frame').first().boundingBox();

await win.keyboard.press('p');
await win.mouse.move(b.x + 120, b.y + 200);
await win.mouse.down();
for (let i = 1; i <= 30; i++) await win.mouse.move(b.x + 120 + i * 8, b.y + 200 + Math.sin(i / 3) * 15);
await win.mouse.up();
check(await win.evaluate(() => app.ed.activePage.data?.objects?.[0]?.isInk === true), 'pen stroke recorded');

await win.keyboard.press('t');
await win.mouse.click(b.x + 150, b.y + 320);
await win.keyboard.type('Smoke test text');
await win.keyboard.press('Escape');
check(await win.evaluate(() => app.ed.activePage.data.objects.some((o) => o.type === 'textbox' && o.text === 'Smoke test text')), 'text box created');

await win.keyboard.press('Escape');
await win.keyboard.press('r');
await win.mouse.move(b.x + 400, b.y + 420);
await win.mouse.down();
await win.mouse.move(b.x + 520, b.y + 500, { steps: 6 });
await win.mouse.up();
check(await win.evaluate(() => app.ed.selection()?.object?.shapeKind === 'rect'), 'rectangle drawn and selected');

const undoWorks = await win.evaluate(() => { const n = app.ed.activePage.data.objects.length; app.ed.undo(); const m = app.ed.activePage.data.objects.length; app.ed.redo(); return n - m === 1 && app.ed.activePage.data.objects.length === n; });
check(undoWorks, 'undo and redo step exactly one action');

const result = await win.evaluate(async () => {
  const { PDFLib } = window;
  const doc = await PDFLib.PDFDocument.create();
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  doc.addPage([595, 842]).drawText('Imported page', { x: 60, y: 760, size: 20, font });
  doc.addPage([842, 595]);
  await app.insertPdf(await doc.save(), 'test.pdf');
  const ex = await import('./js/exporter.js');
  const pdfBytes = await ex.exportPdf(app.ed, app.ed.pages.map((p) => p.id), { quality: 1.5 });
  const out = await PDFLib.PDFDocument.load(pdfBytes);
  const { serialize, deserialize } = await import('./js/doc.js');
  const nb = await deserialize(await serialize({ title: app.ed.title, pages: app.ed.pages, assets: app.ed.assets, meta: app.ed.meta }));
  return { pages: app.ed.pages.length, exported: out.getPageCount(), reloaded: nb.pages.length, objects: nb.pages[0].data.objects.length };
});
check(result.pages === 3 && result.exported === 3, `PDF import + export (${JSON.stringify(result)})`);
check(result.reloaded === 3 && result.objects >= 3, 'notebook save/reload round-trip');

await win.screenshot({ path: path.join(root, 'tests', 'smoke.png') });
await app.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(() => {});
if (errors.length) {
  console.error(`\n${errors.length} error(s):\n${errors.join('\n')}`);
  process.exit(1);
}
console.log('\nSmoke test passed');
