async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(3500);
  await page.evaluate(() => { try { window.__capy.hud.cross('cali'); } catch (e) { window.__capy.biome.switchTo('cali'); } });
  await wait(9000);
  // Cali (salsa, 100 bpm 4/4) -> Rio (samba, 132 bpm 2/4): the two palettes
  // furthest apart in tempo AND metre, which is the case the hold exists for.
  const out = await page.evaluate(() => new Promise(res => {
    const g = window.__capy;
    const rows = [];
    const t0 = performance.now();
    const snap = () => {
      const a = g.musAudit();
      let bt = null;
      try { bt = g.music.beats(); } catch (e) { bt = 'THREW'; }
      rows.push({ t: Math.round(performance.now() - t0), busy: a.busy, band: a.band,
                  bar: a.bar, beatLen: a.beatLen, barAt: a.barAt,
                  duck: a.duck, playing: !!g.music.playing,
                  beats: typeof bt === 'number' ? +bt.toFixed(2) : bt });
    };
    snap();
    try { g.hud.cross('rio'); } catch (e) { g.biome.switchTo('rio'); }
    let n = 0;
    (function step() {
      snap();
      if (++n < 200) requestAnimationFrame(step); else res(rows);
    })();
  }));
  const err = await page.evaluate(() => window.__capy.state.lastError ? String(window.__capy.state.lastError) : null);
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), { rows: out, err: err });
  await page.evaluate(s => fetch('/shot?name=f3b-cross.json', { method: 'POST', body: s }), bl);
}
