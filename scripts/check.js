// Syntax-checks every source file (CommonJS main process + ES module renderer).
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'vendor') walk(p); } else if (/\.(c?js)$/.test(e.name)) files.push(p);
  }
})(path.join(root, 'src'));
files.push(...['scripts/vendor.js', 'build/afterPack.cjs'].map((f) => path.join(root, f)));

let failed = 0;
for (const f of files) {
  const isModule = f.includes(`${path.sep}renderer${path.sep}`);
  const r = isModule
    ? spawnSync(process.execPath, ['--input-type=module', '--check'], { input: fs.readFileSync(f), encoding: 'utf8' })
    : spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) { failed++; console.error(`✗ ${path.relative(root, f)}\n${r.stderr}`); }
}
console.log(failed ? `${failed} file(s) failed` : `✓ ${files.length} files OK`);
process.exit(failed ? 1 : 0);
