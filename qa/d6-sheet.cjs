// A CONTACT SHEET, because nineteen screenshots read one at a time are not a
// sweep — they are nineteen separate opinions, and the thing that catches a
// board standing on a shop roof is seeing all nineteen at once.
//
//   node qa/d6-sheet.cjs        (after qa/d6-board.js has written qa/d6b-*.png)
//   then open http://localhost:5188/qa/sheet.html and screenshot it full-page
//
// The dev server already serves qa/, so this needs no build step and no image
// library: the browser does the compositing.
const fs = require('fs');
const names = fs.readdirSync(__dirname)
  .filter(f => /^d6b-\d+-.*\.png$/.test(f))
  .sort((a, b) => parseInt(a.slice(4), 10) - parseInt(b.slice(4), 10));
const cells = names.map(n =>
  '<figure><img src="/qa/' + n + '"><figcaption>' +
  n.replace('d6b-', '').replace('.png', '') + '</figcaption></figure>').join('');
fs.writeFileSync(__dirname + '/sheet.html',
  '<style>body{margin:0;background:#111;font:13px monospace;color:#eee}' +
  'main{display:grid;grid-template-columns:repeat(3,1fr);gap:3px}' +
  'figure{margin:0;position:relative}img{width:100%;display:block}' +
  'figcaption{position:absolute;left:0;top:0;background:#000a;padding:2px 5px}</style>' +
  '<main>' + cells + '</main>');
console.log(names.length + ' frames -> qa/sheet.html');
