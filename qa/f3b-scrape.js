async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(4000);
  const out = {};

  // ---- baseline: standing still, the scrape must read exactly zero --------
  out.still = await page.evaluate(() => {
    const a = window.__capy.hud.mixAudit();
    return { scrape: a.scrape, g: a.scrapeG, f: a.scrapeF, sliding: !!window.__capy.capy.sliding };
  });

  // ---- run, then slide, sampling every 60 ms ------------------------------
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyW');
  await wait(2200);
  const spdIn = await page.evaluate(() => {
    const v = window.__capy.capy.velocity;
    return +Math.hypot(v.x, v.z).toFixed(2);
  });
  await page.keyboard.down('KeyG');
  const rows = await page.evaluate(async () => {
    const g = window.__capy;
    const r = [];
    for (let i = 0; i < 34; i++) {
      const a = g.hud.mixAudit();
      const v = g.capy.velocity;
      r.push({ t: i * 60, sliding: !!g.capy.sliding, grounded: !!g.capy.grounded,
               air: typeof g.capy.slideAir === "number" ? +g.capy.slideAir.toFixed(3) : null,
               spd: +Math.hypot(v.x, v.z).toFixed(2),
               surf: typeof g.capy.slideSurf === 'number' ? +g.capy.slideSurf.toFixed(2) : null,
               k: a.scrape, gain: a.scrapeG, hz: a.scrapeF, rush: a.rush });
      await new Promise(x => setTimeout(x, 60));
    }
    return r;
  });
  await page.keyboard.up('KeyG');
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ShiftLeft');
  out.spdIn = spdIn;
  out.slide = rows;

  // ---- and it comes back to zero once the animal is up again --------------
  await wait(1400);
  out.after = await page.evaluate(() => {
    const a = window.__capy.hud.mixAudit();
    return { scrape: a.scrape, g: a.scrapeG, sliding: !!window.__capy.capy.sliding };
  });
  out.err = await page.evaluate(() => window.__capy.state.lastError ? String(window.__capy.state.lastError) : null);

  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f3b-scrape.json', { method: 'POST', body: s }), bl);
}
