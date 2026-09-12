// qa/l4-governor.js — THE GOVERNOR under a slow CPU (L4, E6 / qa #4).
//
// Three phases, one JSON (qa/l4-governor.json.png):
//
//   throttled   Hanoi, CPU throttled ×4 through CDP, walking, 120 s sampled
//               once a second: fps (the governor's own half-second mean),
//               rung, dpr, shadow map, the fast line. PASS when, over every
//               pair of consecutive samples with fps < 30, the rung never
//               falls and the dpr never rises (the review measured dpr
//               0.6 → 1.0 at 8.4 fps in Hanoi before; qa/l4r-qa-perf.json).
//               Also latches the first-step-down toast and reads the perf
//               overlay's rung line.
//   released    the throttle off, 40 s more — the up path, if the machine has one.
//   pinned      a fresh load with prefs pf = 1 (`pretty`) in Sydney, 20 s: the
//               rung must stay 0 whatever the frame costs, and a settled frame
//               at 1280×760 is saved as qa/l4-gov-sydney.png for
//               `node qa/l3-luma.mjs qa/l3-sydney.png qa/l4-gov-sydney.png`.
async page => {
  const out = { throttled: [], released: [], pinned: [], toast: false, overlay: null, verdict: {} };
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  await page.evaluate(() => { window.__capy.hud.cross('hanoi'); });
  await page.waitForTimeout(6000);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  // walk: W held with a run, a turn every 2.5 s (qa/l4r-qa-perf.js's loop)
  await page.evaluate(() => {
    const g = window.__capy;
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
    down('KeyW'); down('ShiftLeft');
    let k = 0;
    g.__l4gov = { toast: false, timer: setInterval(() => {
      k++;
      const key = (k & 1) ? 'KeyA' : 'KeyD';
      down(key); setTimeout(() => up(key), 700);
      if (k % 4 === 0) { down('Space'); setTimeout(() => up('Space'), 120); }
    }, 2500) };
    // latch the note the first time it is on screen
    g.__l4gov.watch = setInterval(() => {
      const t = (document.body.innerText || '').toLowerCase();   // notes render in caps
      if (t.indexOf('drawing a little less') >= 0) g.__l4gov.toast = true;
    }, 250);
  });
  const sample = () => page.evaluate(() => {
    const g = window.__capy;
    const a = g.perfAudit();
    return { t: +(performance.now() / 1000).toFixed(1), fps: +(1000 / a.ms).toFixed(1), ms: a.ms, rung: a.rung,
             dpr: a.dpr, shadow: a.shadow, fastMs: a.fastMs, peak: a.peak, slowT: a.slowT, fastT: a.fastT,
             upNeed: a.upNeed, toast: !!(g.__l4gov && g.__l4gov.toast), biome: g.biome.current, perfRung: g.state.perfRung };
  });
  for (let i = 0; i < 120; i++) { await page.waitForTimeout(1000); out.throttled.push(await sample()); }
  // the overlay
  await page.keyboard.press('Backquote');
  await page.waitForTimeout(800);
  out.overlay = await page.evaluate(() => { const e = document.querySelector('.capyui-perf'); return e ? e.textContent : null; });
  await page.keyboard.press('Backquote');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(1000); out.released.push(await sample()); }
  await page.evaluate(() => {
    const g = window.__capy; clearInterval(g.__l4gov.timer); clearInterval(g.__l4gov.watch);
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
    up('KeyW'); up('ShiftLeft');
  });
  out.toast = out.throttled.some(s => s.toast) || out.released.some(s => s.toast);
  // verdict on the throttled run
  let rungDrops = 0, dprRises = 0, slowPairs = 0;
  for (let i = 1; i < out.throttled.length; i++) {
    const a = out.throttled[i - 1], b = out.throttled[i];
    if (a.fps < 30 && b.fps < 30) {
      slowPairs++;
      if (b.rung < a.rung) rungDrops++;
      if (b.dpr > a.dpr + 1e-6) dprRises++;
    }
  }
  out.verdict = { slowPairs, rungDrops, dprRises,
                  rungMax: Math.max(...out.throttled.map(s => s.rung)),
                  dprMin: Math.min(...out.throttled.map(s => s.dpr)),
                  fpsMean: +(out.throttled.reduce((s, r) => s + r.fps, 0) / out.throttled.length).toFixed(1),
                  pass: rungDrops === 0 && dprRises === 0 };
  // the throttled result is on disk before the pinned phase can fail it
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4-governor.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);

  // ---- pinned: pretty, in Sydney, and the frame for l3-luma ------------------
  await page.setViewportSize({ width: 1280, height: 760 });
  await page.addInitScript(() => {
    try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })); } catch (e) {}
  });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(5200);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(11000);
  await page.screenshot({ path: 'qa/l4-gov-sydney.png', timeout: 90000 });
  for (let i = 0; i < 20; i++) { await page.waitForTimeout(1000); out.pinned.push(await sample()); }
  out.pinnedMode = await page.evaluate(() => window.__capy.perfAudit().mode);
  out.pinnedRungMax = Math.max(...out.pinned.map(s => s.rung));
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4-governor.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
