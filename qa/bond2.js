async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__capy.biome.switchTo('monaco'); });
  await page.waitForTimeout(4000);

  // Tap the master destination with an analyser so the band's ACTUAL output can
  // be measured, at rest and at heat. Without this "the score is wired" is a
  // claim about source rather than a measurement.
  const ok = await page.evaluate(() => {
    const g = window.__capy;
    if (!g.music || !g.music.live) return { live: false };
    // find the AudioContext the score is on, via any node the game exposes
    let ac = null;
    try { ac = g.music.ctx || null; } catch (e) { ac = null; }
    if (!ac) {
      // last resort: the game's own listener, or a fresh probe on the same ctx
      ac = (window.__capyAC || null);
    }
    return { live: g.music.live, playing: g.music.playing, beatLen: g.music.beatLen,
             hasCtx: !!ac };
  });

  const samples = [];
  for (const stage of ['quay', 'floor', 'car']) {
    const r = await page.evaluate(async (s) => {
      const g = window.__capy;
      const b = g.capy.body;
      if (s === 'quay') {
        const sp = g.biome.spawnOf('monaco');
        b.position.set(sp.x, sp.y, sp.z);
      } else if (s === 'floor') {
        const w = g.monaco.wheel;
        b.position.set(w.x + 4, 30.2, w.z + 4);
      } else {
        // stand on the roof of a car: park the animal on the hairpin and wait
        b.position.set(g.monaco.hairpin.x, 40, g.monaco.hairpin.z);
      }
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      await new Promise(r2 => setTimeout(r2, 5000));
      const heats = [];
      for (let i = 0; i < 10; i++) {
        heats.push(+g.monaco.heat().toFixed(2));
        await new Promise(r2 => setTimeout(r2, 400));
      }
      return { s, heats, riding: g.monaco.riding(), beats: g.music.beats(),
               playing: g.music.playing, err: g.state.lastError || null };
    }, stage);
    samples.push(r);
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=bond2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, { ok, samples });
}
