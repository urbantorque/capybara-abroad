// THE UI'S OWN VOCABULARY, COUNTED.
//
// A design system is not a document, it is how many different answers the CSS
// gives to the same question. This counts them: corner radii, type sizes,
// shadows, MOTION (D6), and the one rule the aesthetic law implies but never
// states — that paper does not get an ink-coloured border.
//
// TWO STYLESHEETS, NOT ONE (D6). The HUD is built in systems.js and the boot
// card is written by hand in index.html, and for a long time nobody counted
// the second one — which is exactly how it ended up being a self-contained
// mini design system with its own colours, its own type scale and a rotating
// ring spinner. It is the only screen a player on a slow connection sees.
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
const hud = s.slice(a, b);

// ...and the boot card's, which is a plain <style> block.
const idx = fs.readFileSync('index.html', 'utf8');
const ba = idx.indexOf('<style>');
const bb = idx.indexOf('</style>', ba);
if (ba < 0 || bb < 0) { console.log('could not find index.html style'); process.exit(1); }
const boot = idx.slice(ba, bb);

function tally(css, re, label, norm) {
  const m = new Map();
  for (const x of css.matchAll(re)) {
    let v = (norm ? norm(x[1]) : x[1]).trim();
    m.set(v, (m.get(v) || 0) + 1);
  }
  const rows = [...m.entries()].sort((p, q) => q[1] - p[1]);
  let uses = 0;
  for (const [, k] of rows) uses += k;
  console.log('\n' + label + ': ' + rows.length + ' distinct, ' + uses + ' uses');
  for (const [v, k] of rows) console.log('   ' + String(k).padStart(3) + '  ' + v);
  return rows;
}

console.log('================ THE HUD (src/systems.js) ================');
const radii = tally(hud, /border-radius:([^;']+)/g, 'corner radii');
const fonts = tally(hud, /font-size:([^;']+)/g, 'type sizes');
const shadow = tally(hud, /box-shadow:([^;']+)/g, 'shadows', (v) => v.replace(/\s+/g, ' '));

// ---- MOTION (D6) ----------------------------------------------------------
// The axis P7 did not tokenise, and the one that is hardest to look at
// directly: before D6 there were THIRTEEN distinct cubic-beziers across
// eighteen uses — five of them overshoots differing in the second control
// point by a tenth — and thirty-seven distinct durations across a hundred and
// two.
//
// A NAMED CURVE IS NOT COUNTED AS A LITERAL, which is the whole point of the
// count: `mSnap` appears in the source as an identifier, so what is left in
// this tally is the curves nobody gave a name to. The four definitions
// themselves live above the stylesheet and are excluded by the slice.
const curves = tally(hud, /cubic-bezier\(([^)]*)\)/g, 'un-named easing curves',
                     (v) => v.replace(/\s+/g, ''));
// Durations, likewise: `dFast`/`dMed`/`dSlow` are identifiers by the time this
// reads the file, so a literal here is a number somebody wrote by hand. The
// long ones are meant to be here — a story beat is not a token — so they are
// split out rather than counted against the total.
const durAll = new Map();
for (const x of hud.matchAll(/([0-9]*\.?[0-9]+)(ms|s)\b/g)) {
  const v = x[1] + x[2];
  durAll.set(v, (durAll.get(v) || 0) + 1);
}
const secs = (v) => v.endsWith('ms') ? parseFloat(v) / 1000 : parseFloat(v);
const short = [...durAll.entries()].filter(([v]) => secs(v) <= 0.55 && secs(v) > 0.02);
const long = [...durAll.entries()].filter(([v]) => secs(v) > 0.55);
const tiny = [...durAll.entries()].filter(([v]) => secs(v) <= 0.02);
console.log('\nun-named durations at or under .55s: ' + short.length + ' distinct');
console.log('   ' + short.sort((p, q) => q[1] - p[1]).map(([v, k]) => k + 'x' + v).join('  '));
console.log('story beats over .55s (not tokens, and must not be): ' + long.length + ' distinct');
console.log('   ' + long.sort((p, q) => secs(p[0]) - secs(q[0])).map(([v, k]) => k + 'x' + v).join('  '));
console.log('sub-frame (reduced motion, stagger): ' + tiny.length + ' distinct');

// paper never gets an ink border: a border whose colour token is the ink is a
// drawn outline, which the aesthetic law forbids in 3D and which reads the same
// way on a card.
const inkBorders = [];
for (const m of hud.matchAll(/'\.([a-z-]+)\{[^']*border:[^;']*'\s*\+\s*(ink|inkSoft)\b/g)) {
  inkBorders.push(m[1] + ' -> ' + m[2]);
}
console.log('\nink-coloured borders on paper: ' + inkBorders.length);
for (const x of inkBorders) console.log('   ' + x);

// ---- AND THE ONE THING THAT SHOULD NOT BE THERE AT ALL (D6) --------------
// A Unicode character used as a picture. The HUD had five — a tick, two
// disclosure triangles, a down triangle and a left arrow — set in whatever
// face the platform happens to have, which is a different weight and a
// different century from the nineteen hand-cut marks beside them.
const uni = [];
for (const m of hud.matchAll(/content:"\\\\([0-9A-Fa-f]{4})"/g)) uni.push('U+' + m[1]);
for (const m of hud.matchAll(/[←-⇿■-◿✓✔]/g)) uni.push(m[0]);
console.log('\nUnicode used as a picture: ' + uni.length + (uni.length ? '  ' + uni.join(' ') : ''));

console.log('\n================ THE BOOT CARD (index.html) ================');
const bRadii = tally(boot, /border-radius:([^;]+)/g, 'corner radii');
const bFonts = tally(boot, /font-size:([^;]+)/g, 'type sizes');
const bShadow = tally(boot, /box-shadow:([^;]+)/g, 'shadows', (v) => v.replace(/\s+/g, ' '));
// The boot card cannot import the palette — it draws before a module has been
// fetched — so its colours are hand-copied hexes. What matters is that they
// are the CARD's hexes and not a second scheme: sail, sailShade, ibisHead,
// cloth1/accentInk, stoneDark, sandstone, fog, skyBottom and the capybara.
const KNOWN = new Set(['#faf6ec', '#e6dfcd', '#3a332c', '#e98b7a', '#9e5f53', '#b5ab97',
                       '#e4d3ad', '#cfe8ef', '#dff2f2', '#b0784a', '#94603a', '#c79063',
                       '#8a5a37', '#2f2118', '#5f3d29', '#69a05a', '#fff', '#ffd9a0',
                       '#3a3229']);
const stray = [];
for (const m of boot.matchAll(/#[0-9a-fA-F]{3,6}\b/g)) {
  if (!KNOWN.has(m[0].toLowerCase())) stray.push(m[0]);
}
console.log('\ncolours that are not the card\'s: ' + stray.length +
            (stray.length ? '  ' + [...new Set(stray)].join(' ') : ''));

console.log('\nSUMMARY  hud: radii ' + radii.length + '  type ' + fonts.length +
            '  shadows ' + shadow.length + '  curves ' + curves.length +
            '  durations ' + short.length + '  ink-borders ' + inkBorders.length +
            '  unicode ' + uni.length);
console.log('         boot: radii ' + bRadii.length + '  type ' + bFonts.length +
            '  shadows ' + bShadow.length + '  stray colours ' + [...new Set(stray)].length);
