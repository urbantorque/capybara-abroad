// Every player-facing sentence in the game, and which of them are said twice.
// A repeat is not automatically wrong — 'Whoa!' belongs in two pools — but a
// SENTENCE repeated across two chapters is a chapter borrowing another
// chapter's voice, which is what this is looking for.
const fs = require('fs');
const path = require('path');
const files = fs.readdirSync('src').filter(f => f.endsWith('.js'));
const seen = new Map();
for (const f of files) {
  const src = fs.readFileSync(path.join('src', f), 'utf8');
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (/^\s*(\/\/|\*|\/\*)/.test(L)) continue;          // comments are not dialogue
    for (const m of L.matchAll(/'([^'\\]{14,120})'/g)) {
      const t = m[1];
      // sentences only: must contain a space and at least one lower-case word,
      // and must not look like css, a selector, a path or an id
      if (!/ /.test(t)) continue;
      if (/[{}:;#<>=]|px|vw|rgba|\.js|capyui|--/.test(t)) continue;
      if (!/[a-z]{3}/.test(t)) continue;
      if (!seen.has(t)) seen.set(t, []);
      seen.get(t).push(f + ':' + (i + 1));
    }
  }
}
const dups = [...seen.entries()].filter(([t, w]) => {
  if (w.length < 2) return false;
  const fset = new Set(w.map(x => x.split(':')[0]));
  return fset.size > 1;                                   // across files only
});
console.log('cross-file repeated sentences: ' + dups.length);
for (const [t, w] of dups) console.log('  "' + t + '"\n      ' + w.join('  '));
