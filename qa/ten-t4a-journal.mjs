// ROADMAP-TEN T4a: the journal in chapter one, and the key that closes it.
// A fresh story file, real keys: Tab opens the journal, its head has no clock
// and no 'noticed' while the animal has stood nowhere but Sydney, and a second
// Tab (focus on the card, not a control) closes it and the world runs again.
//   CAPY_QA_URL=http://localhost:5191/ node qa/ten-t4a-journal.mjs
import { openSlow } from './ten-t4a-open.mjs';
const h = await openSlow({ width: 1280, height: 720 });
const p = h.page;
let checks = 0; const fails = [];
const ok = (c, m) => { if (c) checks++; else fails.push(m); console.log((c ? 'ok   ' : 'FAIL ') + m); };
try {
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })); });
  await p.reload({ timeout: 150000 });
  await p.waitForFunction(() => !!window.__capy && !!document.querySelector('.capyui-go'), null, { timeout: 150000 });
  await h.start();
  // past the opening and the premise card
  await p.keyboard.press('Shift'); await p.waitForTimeout(12000); await p.keyboard.press('Shift'); await p.waitForTimeout(6000);
  const st = () => p.evaluate(() => ({ jr: !!document.querySelector('.capyui-jr.show'), paused: !!window.__capy.state.paused,
    head: (document.querySelector('.capyui-jr .capyui-jrsub') || {}).textContent || '', biome: window.__capy.biome.current,
    focus: document.activeElement ? document.activeElement.className : '' }));
  await p.keyboard.press('Tab'); await p.waitForTimeout(900);
  const a = await st();
  console.log('open', JSON.stringify(a));
  await h.screenshot('ten-t4a-journal');
  ok(a.jr, 'Tab opens the journal');
  ok(a.head && !/\d+:\d\d/.test(a.head), 'no clock in chapter one: "' + a.head + '"');
  ok(!/noticed/i.test(a.head), 'no "noticed" in chapter one');
  await p.keyboard.press('Tab'); await p.waitForTimeout(900);
  const b = await st();
  console.log('after', JSON.stringify(b));
  ok(!b.jr, 'a second Tab closes it (focus on the card)');
  ok(!b.paused, 'and the world runs again');
  ok(!h.metadata.errors.filter(e => e.kind === 'pageerror').length, '0 page errors');
} finally { await h.close(); }
console.log(fails.length ? 'FAILED: ' + fails.join(' | ') : 'journal: ' + checks + ' checks pass.');
if (fails.length) process.exitCode = 1;
