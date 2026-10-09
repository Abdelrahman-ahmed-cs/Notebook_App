// Copies the browser builds of the renderer libraries into src/renderer/vendor
// so the packaged app loads everything locally (fully offline, no node_modules at runtime).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'src', 'renderer', 'vendor');
const nm = (...p) => path.join(root, 'node_modules', ...p);

const files = [
  [nm('fabric', 'dist', 'fabric.min.js'), 'fabric.min.js'],
  [nm('pdfjs-dist', 'build', 'pdf.min.js'), 'pdf.min.js'],
  [nm('pdfjs-dist', 'build', 'pdf.worker.min.js'), 'pdf.worker.min.js'],
  [nm('pdf-lib', 'dist', 'pdf-lib.min.js'), 'pdf-lib.min.js'],
  [nm('jszip', 'dist', 'jszip.min.js'), 'jszip.min.js'],
  [nm('perfect-freehand', 'dist', 'esm', 'index.mjs'), 'perfect-freehand.js'],
];
const dirs = [
  [nm('pdfjs-dist', 'cmaps'), 'cmaps'],
  [nm('pdfjs-dist', 'standard_fonts'), 'standard_fonts'],
];

if (!fs.existsSync(nm('fabric'))) {
  console.log('[vendor] node_modules not installed yet, skipping');
  process.exit(0);
}
fs.mkdirSync(out, { recursive: true });
for (const [src, name] of files) fs.copyFileSync(src, path.join(out, name));

// Fabric 5.3 assigns the invalid canvas value 'alphabetical' (Chromium logs a warning per glyph run).
const fabricFile = path.join(out, 'fabric.min.js');
fs.writeFileSync(fabricFile, fs.readFileSync(fabricFile, 'utf8').replace(/(textBaseline\s*=\s*)["']alphabetical["']/g, '$1"alphabetic"'));
for (const [src, name] of dirs) fs.cpSync(src, path.join(out, name), { recursive: true });
console.log('[vendor] copied renderer libraries to', path.relative(root, out));
