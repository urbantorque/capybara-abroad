// THE UI'S OWN VOCABULARY, COUNTED.
//
// A design system is not a document, it is how many different answers the CSS
// gives to the same question. This counts them: corner radii, type sizes,
// shadows, and the one rule the aesthetic law implies but never states — that
// paper does not get an ink-coloured border.
//
// Run: node qa/p7-tokens.cjs
const fs = require('fs');
const s = fs.readFileSync('src/systems.js', 'utf8');

// The HUD stylesheet is the array of string literals returned from the CSS
// builder. Take everything between the two markers rather than the whole file,
// or the audit counts numbers out of the shaders.
const a = s.indexOf("'.capyui *{box-sizing:border-box;}'");
const b = s.indexOf('].join(', a);
if (a < 0 || b < 0) { console.log('could not find the stylesheet'); process.exit(1); }
const css = s.slice(a, b);

function tally(re, label, norm) {
  const m = new Map();
  for (const x of css.matchAll(re)) {
    let v = (norm ? norm(x[1]) : x[1]).trim();
    m.set(v, (m.get(v) || 0) + 1);
  }
  const rows = [...m.entries()].sort((p, q) => q[1] - p[1]);
  console.log('\n' + label + ': ' + rows.length + ' distinct');
  for (const [v, k] of rows) console.log('   ' + String(k).padStart(3) + '  ' + v);
  return rows;
}

const radii = tally(/border-radius:([^;']+)/g, 'corner radii');
const fonts = tally(/font-size:([^;']+)/g, 'type sizes');
const shadow = tally(/box-shadow:([^;']+)/g, 'shadows', (v) => v.replace(/\s+/g, ' '));

// paper never gets an ink border: a border whose colour token is the ink is a
// drawn outline, which the aesthetic law forbids in 3D and which reads the same
// way on a card.
const inkBorders = [];
for (const m of css.matchAll(/'\.([a-z-]+)\{[^']*border:[^;']*'\s*\+\s*(ink|inkSoft)\b/g)) {
  inkBorders.push(m[1] + ' -> ' + m[2]);
}
console.log('\nink-coloured borders on paper: ' + inkBorders.length);
for (const x of inkBorders) console.log('   ' + x);

console.log('\nSUMMARY  radii ' + radii.length + '  type ' + fonts.length +
            '  shadows ' + shadow.length + '  ink-borders ' + inkBorders.length);
