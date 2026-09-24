// ROADMAP-TEN T4a: the ending, watched end to end. A story file with every
// task done (the fast-forward: the save is written, not played), Sydney, the
// animal set down six metres out on the mouth's line and walked in with real
// keys, then left alone to sit. It captures the traveller's set-down, the coda
// caption, the last frame and the ledger, and checks:
//   staged keepsakes >= 10; keepsake screen height at 1280 (reported, 18 px is
//   T4b's 2.2x to meet); the caption is the pill and its contrast >= 4.5:1;
//   the traveller within 2 m of the bag as it lands; the bag beside the animal;
//   the ledger no sooner than 16 s after the sit; the title steps; the unvisited
//   row; 0 page errors.
//   CAPY_QA_URL=http://localhost:5191/ node qa/ten-t4a-finale.mjs [--free-only]
import assert from 'node:assert/strict';
import { openSlow } from './ten-t4a-open.mjs';
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const SKIP = (process.env.CAPY_QA_SKIP || '').split(',');   // e.g. 'antarctic,cave' left unvisited
const h = await openSlow({ width: 1280, height: 720 });
const p = h.page;
let checks = 0; const fails = [];
const ok = (c, m) => { if (c) checks++; else fails.push(m); console.log((c ? 'ok   ' : 'FAIL ') + m); };
const out = {};
try {
  // ---- the fast-forward: every task, every place seen, a story file
  const seeded = await p.evaluate(async skip => {
    const m = await import('/src/shared.js');
    const skipN = m.CHAPTERS.map(c => ({ c, n: c.n })).filter(o => skip.includes(o.c.biome)).map(o => o.n);
    const tasks = m.TASKS.filter(t => !skipN.includes(t.chapter)).map(t => t.id);
    const seen = []; for (let k = 1; k <= 19; k++) if (!skipN.includes(k)) seen.push(k);
    localStorage.clear();
    localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 }));
    localStorage.setItem('capy3.journey.v1', JSON.stringify({ v: 1, tasks, seen, recs: {}, told: 1, rtold: 1,
      ms: 9000000, chapms: {}, finds: [], foundAt: {}, biome: 'sydney', fin: 0, tut: 1,
      journeyMode: 'story', arcV1: 1 }));
    return { tasks: tasks.length, seen: seen.length, skipN };
  }, SKIP.filter(Boolean));
  out.seeded = seeded;
  await p.reload({ timeout: 150000 }); await p.waitForFunction(() => !!window.__capy && !!document.querySelector('.capyui-go'), null, { timeout: 150000 });
  await p.waitForTimeout(1500);
  await h.start();
  await p.waitForTimeout(2500);
  out.start = await p.evaluate(() => { const g = window.__capy; return { biome: g.biome.current, mode: g.state.journeyMode, fin: g.finAudit() }; });
  console.log('start', JSON.stringify(out.start));
  ok(out.start.fin.staged, 'the horseshoe is staged on arrival');
  ok(out.start.fin.keeps >= 10, 'ten keepsakes or more staged (' + out.start.fin.keeps + ')');
  // ---- set down six metres out on the mouth's line, then walk in with keys
  const lay = await p.evaluate(() => {
    const g = window.__capy, t = g.travFinAt ? g.travFinAt() : null;
    const X = 30, Z = 26, mo = t ? t.mouth : Math.PI;
    const x = X + Math.cos(mo) * 6.5, z = Z + Math.sin(mo) * 6.5;
    const b = g.capy.body; b.position.set(x, b.position.y + 1.2, z); b.velocity.set(0, 0, 0);
    return { mouth: mo, x, z, trav: t };
  });
  out.lay = lay;
  const held = new Set();
  const setKeys = async want => {
    for (const k of [...held]) if (!want.has(k)) { await p.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await p.keyboard.down(k); held.add(k); }
  };
  const t0 = Date.now(); const now = () => (Date.now() - t0) / 1000;
  let bagShot = false, travMin = 1e9;
  while (now() < 25) {
    const s = await p.evaluate(() => { const g = window.__capy, q = g.capy.position; return { x: q.x, z: q.z, camYaw: g.input.camYaw }; });
    const dx = 30 - s.x, dz = 26 - s.z, d = Math.hypot(dx, dz);
    if (d < 0.5) break;
    const cy = Math.cos(s.camYaw), sy = Math.sin(s.camYaw);
    const ix = dx * cy - dz * sy, iz = dx * sy + dz * cy;
    const want = new Set();
    if (iz < -0.3 * d) want.add('KeyW'); if (iz > 0.3 * d) want.add('KeyS');
    if (ix < -0.3 * d) want.add('KeyA'); if (ix > 0.3 * d) want.add('KeyD');
    await setKeys(want); await p.waitForTimeout(110);
  }
  await setKeys(new Set());
  out.walkT = +now().toFixed(1);
  // ---- sit, and watch everything until the ledger
  const tSit = Date.now();
  const samples = [];
  let codaShot = 0, lastShot = false, ledShot = false, keepPx = null, contrast = null;
  for (let i = 0; i < 140; i++) {
    const s = await p.evaluate(() => {
      const g = window.__capy, f = g.finAudit(), led = document.querySelector('.capyui-led.show');
      return { t: +g.state.time.toFixed(1), loaf: +(g.capy.loaf || 0).toFixed(2), f, led: !!led,
               ledTitle: led ? led.querySelector('h2').textContent : '',
               ledText: led ? led.textContent.replace(/\s+/g, ' ').slice(-600) : '',
               err: g.state.lastError || null };
    });
    s.wall = +((Date.now() - tSit) / 1000).toFixed(1);
    samples.push({ wall: s.wall, st: s.f.trav && s.f.trav.st, bag: s.f.bagDown, closing: s.f.closing, coda: s.f.coda.slice(0, 40), nap: s.f.napped, led: s.led });
    if (s.f.trav && s.f.bagDown && s.f.bagToSpot >= 0) {
      const tv = s.f.trav, bp = await p.evaluate(() => { const b = window.__capy.finBag(); return b; });
      if (bp) travMin = Math.min(travMin, Math.hypot(tv.x - bp.x, tv.z - bp.z));
      if (!bagShot && s.f.bagVisible) { await h.screenshot('ten-t4a-bag'); bagShot = true; out.bagAt = { trav: tv, bag: bp, capy: s.f.bagToCapy }; }
    }
    if (s.f.coda && s.f.pill && codaShot < 2) {
      await h.screenshot('ten-t4a-coda-' + codaShot); codaShot++;
      if (!keepPx) keepPx = await p.evaluate(() => window.__capy.finKeepPx());
      if (!contrast) contrast = await p.evaluate(() => {
        const el = document.querySelector('.capyui-coda'), cs = getComputedStyle(el), ci = getComputedStyle(el.querySelector('i'));
        const rgb = s => s.match(/[\d.]+/g).map(Number);
        const lum = c => { const a = c.slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; };
        const bg = rgb(cs.backgroundColor), fg = rgb(cs.color), fi = rgb(ci.color);
        const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
        const r = el.getBoundingClientRect();
        return { name: +cr(fg, bg).toFixed(2), keep: +cr(fi, bg).toFixed(2), bottomPct: +((innerHeight - r.bottom) / innerHeight * 100).toFixed(1), iPx: ci.fontSize };
      });
    }
    if (s.f.napped && !lastShot) { await p.waitForTimeout(500); await h.screenshot('ten-t4a-last'); lastShot = true; }
    if (s.led && !ledShot) { await p.waitForTimeout(1200); await h.screenshot('ten-t4a-ledger'); ledShot = true; await p.waitForTimeout(2500); await p.evaluate(() => { const l = document.querySelector('.capyui-led'); l.scrollTop = l.scrollHeight; }); await p.waitForTimeout(700); await h.screenshot('ten-t4a-ledger-foot'); out.ledger = { title: s.ledTitle, tail: s.ledText, gap: s.f.ledGap, closeAt: s.f.closeAt }; out.fin = s.f; break; }
    await p.waitForTimeout(500);
  }
  out.samples = samples; out.keepPx = keepPx; out.contrast = contrast; out.travMin = travMin;
  const firstClose = samples.find(x => x.closing);
  out.sitToClose = firstClose ? firstClose.wall : -1;
  const ledAt = samples.find(x => x.led);
  out.sitToLedger = ledAt ? ledAt.wall : -1;
  console.log('keepPx', JSON.stringify(keepPx), 'contrast', JSON.stringify(contrast));
  console.log('ledger', JSON.stringify(out.ledger && { title: out.ledger.title, gap: out.ledger.gap }), 'sit->close', out.sitToClose, 'sit->ledger', out.sitToLedger, 'trav-bag min', travMin.toFixed(2));
  ok(bagShot, 'the traveller came to the mouth and bent to the grass');
  ok(travMin <= 2.0, 'the traveller within 2 m of the bag (' + travMin.toFixed(2) + ')');
  ok(out.bagAt && out.bagAt.capy >= 0 && out.bagAt.capy <= 2.1, 'the bag beside the animal, 2.1 m or less (' + (out.bagAt && out.bagAt.capy) + ' m)');
  ok(codaShot > 0, 'the coda caption is the pill');
  ok(contrast && contrast.name >= 4.5 && contrast.keep >= 4.5, 'caption contrast >= 4.5:1');
  ok(contrast && contrast.bottomPct >= 12 && contrast.bottomPct <= 24, 'caption low in the frame (' + (contrast && contrast.bottomPct) + '% up)');
  ok(lastShot, 'the last frame: the animal asleep by the bag');
  ok(ledShot, 'the ledger opened');
  ok(out.sitToLedger >= 16, 'the ledger no sooner than 16 s after the sit (' + out.sitToLedger + ')');
  ok(out.ledger && /BACK WHERE IT BEGAN|FURTHER THAN IT MEANT|MISCHIEF COMPLETE/.test(out.ledger.title), 'a final title: ' + (out.ledger && out.ledger.title));
  if (seeded.skipN.length) ok(out.ledger && /still out there/i.test(out.ledger.tail), 'the unvisited are still out there');
  out.errors = h.metadata.errors;
  ok(!h.metadata.errors.filter(e => e.kind === 'pageerror').length, '0 page errors');
  await h.result('ten-t4a-finale', out);
} finally { await h.close(); }
console.log(fails.length ? 'FAILED: ' + fails.join(' | ') : 'finale: ' + checks + ' checks pass.');
if (fails.length) process.exitCode = 1;
