async page => {
  // ---- THE OVERLAY COUNTS THE FRAME (L4, qa #8) -----------------------------
  // Hanoi, standing. Three readings of one frame's draw calls:
  //   raw      renderer.info.render.calls read straight after a manual
  //            g.tick(1/60, true), before the next tick resets it — the
  //            independent count for that frame
  //   snap     game.state.perf.calls after one more tick — what main.js
  //            copied off the counters at the top of that tick, i.e. the
  //            same frame as `raw`
  //   overlay  the `calls` line of the backquote overlay half a second later
  //            (a different frame of the same standing shot; within 5 %)
  // Before this fix the overlay said `calls 1 / tris 1` in every chapter.
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('http://localhost:5188/', { waitUntil: 'commit', timeout: 90000 });
  await page.waitForTimeout(7000);
  await page.keyboard.press('Slash');           // chapter 19, Hanoi
  await page.waitForTimeout(12000);
  await page.keyboard.press('Backquote');
  await page.waitForTimeout(1000);
  // All of it inside ONE synchronous evaluate, so no rAF frame lands between
  // the manual ticks: the overlay refreshes every 0.35 s of dt, so twenty-four
  // manual sixtieths make it print inside the loop, from the manual frame just
  // before the print. `raws` is every manual frame's own count; the overlay's
  // number must be one of them, and within 5 % of the first.
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const autoReset = g.renderer.info.autoReset;
    g.tick(1 / 60, true);
    const raw = g.renderer.info.render.calls, rawTris = g.renderer.info.render.triangles;
    g.tick(1 / 60, true);
    const p = g.state.perf;
    const snap = p.calls, snapTris = p.triangles;
    const raws = [raw, g.renderer.info.render.calls];
    for (let i = 0; i < 24; i++) { g.tick(1 / 60, true); raws.push(g.renderer.info.render.calls); }
    const ov = (document.querySelector('.capyui-perf') || {}).textContent || '';
    return { biome: g.biome.current, autoReset, raw, rawTris, snap, snapTris, raws,
             programs: p.programs, contacts: p.contacts, substeps: p.substeps,
             overlayText: ov, err: g.state.lastError || null };
  });
  const ov = out.overlayText;
  const m = /calls\s+(\d+)/.exec(ov), mt = /tris\s+(\d+)/.exec(ov), mp = /progs\s+(\d+)\s+contacts\s+(\d+)\s+sub\s+(\d+)/.exec(ov);
  out.overlayCalls = m ? +m[1] : null; out.overlayTris = mt ? +mt[1] : null;
  out.overlayProgs = mp ? +mp[1] : null; out.overlayContacts = mp ? +mp[2] : null; out.overlaySub = mp ? +mp[3] : null;
  out.overlayIsAManualFrame = out.raws.indexOf(out.overlayCalls) >= 0;
  out.callsWithin5pc = out.overlayCalls !== null && Math.abs(out.overlayCalls - out.raw) / out.raw <= 0.05;
  out.pass = out.autoReset === false && out.raw > 50 && out.snap === out.raw && out.callsWithin5pc && out.overlayIsAManualFrame && out.overlayProgs > 0 && !out.err;
  await page.screenshot({ path: 'qa/l4-perf.png' });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4-perf.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
  if (!out.pass) throw new Error('l4-perf FAILED: ' + JSON.stringify(out));
}
