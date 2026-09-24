// ROADMAP-TEN T2 proof slot: a T2 builder's playwright-cli instrument, run
// once more on the merged tree, headful Edge on the reference GPU, rung 0.
//   CAPY_QA_URL=http://localhost:5199/ node qa/ten-t2-proof-run.mjs qa/ten-t2b-orca.js
// The builders wrote bare `async page => {}` scripts against their own ports
// and some forced rung 3 by hand. The text is rewritten, not the file: the
// port becomes the proof server's, a forced `perfRung = 3` becomes 0, every
// localStorage.clear() puts the rung-0 pin (capy3.prefs.v1 pf 1) straight
// back, and each picture and sink name gains a `ten-t2-proof-` prefix so the
// builders' own results are not overwritten.
import { readFileSync } from 'node:fs';
import { openHarness } from './reimagine-harness.mjs';

const file = process.argv[2];
if (!file) throw new Error('usage: node qa/ten-t2-proof-run.mjs <qa/script.js>');
const url = process.env.CAPY_QA_URL || 'http://localhost:5188/';
const port = new URL(url).port;
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const PIN = `localStorage.setItem('capy3.prefs.v1', '{"v":1,"pf":1}')`;
const src = readFileSync(file, 'utf8')
  .replace(/localhost:51\d\d/g, 'localhost:' + port)
  .replace(/PORT = 51\d\d/g, 'PORT = ' + port)
  .replace(/perfRung = 3/g, 'perfRung = 0')
  .replace(/localStorage\.clear\(\)/g, `(localStorage.clear(), ${PIN})`)
  .replace(/'qa\/'/g, `'qa/ten-t2-proof-'`)
  .replace(/path: 'qa\/(?!ten-t2-proof-)/g, `path: 'qa/ten-t2-proof-`)
  .replace(/\/shot\?name='/g, `/shot?name=ten-t2-proof-'`)
  .replace(/\/shot\?name=(?!ten-t2-proof-)(?=[\w-])/g, '/shot?name=ten-t2-proof-');
const run = (0, eval)('(' + src.trim().replace(/;\s*$/, '') + ')');
const h = await openHarness({ url, width: 1280, height: 760 });
try {
  await h.page.bringToFront();
  await run(h.page);
  const rung = await h.page.evaluate(() => window.__capy?.state?.perfRung);
  console.log('done', file, 'rung', rung, 'errors', h.metadata.errors.length,
    JSON.stringify(h.metadata.errors.slice(0, 3)).slice(0, 400));
} finally { await h.close(); }
