// apply.mjs <target> <patchdir>
// patchdir holds NNN.find.txt / NNN.repl.txt pairs; each find must occur exactly once.
import fs from 'fs';
import path from 'path';
const [, , target, dir] = process.argv;
let src = fs.readFileSync(target, 'utf8');
const names = fs.readdirSync(dir).filter(f => f.endsWith('.find.txt')).sort();
for (const r of fs.readdirSync(dir).filter(f => f.endsWith('.repl.txt'))) {
  if (!fs.existsSync(path.join(dir, r.replace('.repl.txt', '.find.txt')))) { console.error('orphan repl without find: ' + r); process.exit(1); }
}
for (const f of names) {
  const key = f.replace('.find.txt', '');
  const find = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n/g, '\n');
  const rf = path.join(dir, key + '.repl.txt');
  const repl = fs.existsSync(rf) ? fs.readFileSync(rf, 'utf8').replace(/\r\n/g, '\n') : '';
  const n = src.split(find).length - 1;
  if (n !== 1) { console.error(`FAIL ${key}: found ${n} occurrences`); process.exit(1); }
  src = src.replace(find, () => repl);
  console.log(`ok ${key}`);
}
fs.writeFileSync(target, src);
console.log('written', target);
