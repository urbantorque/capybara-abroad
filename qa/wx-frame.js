// FRAME TIME, DRY AND WET, ON A REAL CLOCK.
//
// The hand-driven tick loop cannot answer this — it runs as fast as the CPU
// will go and never yields to the compositor — so it is measured under rAF,
// per the same rule the presentation pass was measured under. Three chapters:
// the one with the most instances in its mote field (Marrakech, which never
// rains and is therefore the dry-cost case), the heaviest shower (Kowloon) and
// the busiest geometry (the Pantanal).
async page => {
  const out = {};
  page.on('console', m => { if (m.type() === 'error') (out.errs = out.errs || []).push(m.text().slice(0, 160)); });
  await page.reload();
  await page.waitForTimeout(4500);
  await page.mouse.click(640, 400);
  await page.keyboard.press('Space');
  await page.waitForTimeout(2500);

  for (const name of ['sahara', 'kowloon', 'pantanal', 'kyoto']) {
    out[name] = await page.evaluate(async (n) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      const g = window.__capy, W = g.weather;
      function sample(ms) {
        return new Promise(res => {
          const dts = []; let last = performance.now(); const t0 = last;
          function step() {
            const now = performance.now();
            dts.push(now - last); last = now;
            if (now - t0 < ms) requestAnimationFrame(step);
            else {
              dts.sort((a, b) => a - b);
              res({ med: +dts[dts.length >> 1].toFixed(2),
                    p95: +dts[Math.floor(dts.length * 0.95)].toFixed(2),
                    n: dts.length });
            }
          }
          requestAnimationFrame(step);
        });
      }
      g.biome.switchTo(n);
      await sleep(2500);
      const dry = await sample(3500);
      const b = W.rowOf(n);
      // hold: 400 puts the envelope's peak 88 s out, which is too long for a
      // real-clock test, so the shower is stood up at a hold whose peak lands
      // inside the wait: 0.22 * 60 = 13 s.
      W.set(n, { rain: { odds: 1, peak: b.rain.peak, hold: 60, gap: 1 } });
      await sleep(14000);
      const wet = await sample(3500);
      let motes = 0, streaks = 0;
      g.scene.traverse(o => {
        if (o.isInstancedMesh && o.renderOrder === 6 && o.count > 0) {
          if (o.geometry.attributes.position.count === 24) streaks = o.count; else motes = o.count;
        }
      });
      return { dry, wet, rain: +W.drizzle().toFixed(2), motes, streaks,
               lastError: g.state.lastError || null };
    }, name);
  }
  await page.evaluate(o => fetch('/shot?name=wx-frame.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
