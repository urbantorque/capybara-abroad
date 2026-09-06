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

  // Install ONE rAF sampler that attributes each tick's node creations to the
  // bar index that tick scheduled, bucketed mod 8. Draining a small object
  // rather than a per-frame array, because a long evaluate dies (trap 2) and
  // anything on window can vanish between run-code calls (trap 1).
  await page.evaluate(() => {
    const B = window.BaseAudioContext.prototype;
    if (!B.__f3bRaw) {
      B.__f3bRaw = { o: B.createOscillator, b: B.createBufferSource };
      window.__f3bN = 0;
      B.createOscillator = function () { window.__f3bN++; return B.__f3bRaw.o.apply(this, arguments); };
      B.createBufferSource = function () { window.__f3bN++; return B.__f3bRaw.b.apply(this, arguments); };
    }
    const g = window.__capy;
    const st = { byBar: {}, hits: {}, beats: [], bad: 0, bars: 0, band: null };
    window.__f3b = st;
    let lastN = window.__f3bN, lastBar = g.musAudit().bar, lastBeats = -1;
    (function step() {
      const a = g.musAudit();
      const n = window.__f3bN, dn = n - lastN;
      lastN = n;
      st.band = a.band;
      // beats() must never go backwards through a break
      let bt = null;
      try { bt = g.music.beats(); } catch (e) { bt = 'THREW'; }
      if (typeof bt === 'number' && bt >= 0) {
        if (lastBeats >= 0 && bt < lastBeats - 0.001) st.bad++;
        lastBeats = bt;
      }
      if (a.bar !== lastBar) {
        // the tick that just ran scheduled bar `lastBar`
        const k = ((lastBar % 8) + 8) % 8;
        st.byBar[k] = (st.byBar[k] || 0) + dn;
        st.hits[k] = (st.hits[k] || 0) + 1;
        st.bars++;
        lastBar = a.bar;
      }
      if (window.__f3b === st) requestAnimationFrame(step);
    })();
    return true;
  });
  for (let i = 0; i < 8; i++) await wait(5000);
  const out = await page.evaluate(() => {
    const st = window.__f3b;
    const g = window.__capy;
    const a = g.musAudit();
    const r = { band: st ? st.band : null, bars: st ? st.bars : 0,
                reversals: st ? st.bad : null, byBar: {}, live: a };
    if (st) for (const k in st.byBar) r.byBar[k] = { total: st.byBar[k], ticks: st.hits[k],
                                                    mean: +(st.byBar[k] / st.hits[k]).toFixed(1) };
    window.__f3b = null;   // stop the sampler
    return r;
  });
  out.err = await page.evaluate(() => window.__capy.state.lastError ? String(window.__capy.state.lastError) : null);
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f3b-break.json', { method: 'POST', body: s }), bl);
}
