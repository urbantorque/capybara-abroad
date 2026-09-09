async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload(); await page.waitForTimeout(6500);
  await page.mouse.click(500, 400);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = {};
    const KEYS = ['KeyW','KeyA','KeyS','KeyD','Space','KeyE','KeyQ','ShiftLeft','KeyF','KeyH'];
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown', {code:c, bubbles:true}));
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup', {code:c, bubbles:true}));
    let seed = 777; const rnd = () => { seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; };
    for (const bn of ['venice','kowloon','palawan']) {
      g.state.lastError = null;
      g.biome.switchTo(bn);
      for (let i=0;i<120;i++) g.tick(1/60,false);
      const r = { nan:0, under:0, err:null, bubbles:0 };
      const held = new Set();
      for (let i=0;i<60*400;i++) {
        if (i % 19 === 0) {
          for (const k of held) up(k); held.clear();
          const n = 1 + (rnd()*3|0);
          for (let j=0;j<n;j++) { const k=KEYS[rnd()*KEYS.length|0]; held.add(k); down(k); }
        }
        try { g.tick(1/60,false); } catch(e) { r.err = String(e && e.message); break; }
        const p = g.capy.position;
        if (!isFinite(p.x)||!isFinite(p.y)||!isFinite(p.z)) { r.nan++; break; }
        if (p.y < -60) r.under++;
      }
      for (const k of held) up(k);
      // re-entry: leave and come back, which is where stale state shows up
      g.biome.switchTo(bn === 'venice' ? 'kowloon' : 'venice');
      for (let i=0;i<200;i++) g.tick(1/60,false);
      g.biome.switchTo(bn);
      for (let i=0;i<600;i++) g.tick(1/60,false);
      r.lastError = g.state.lastError || null;
      r.reentryOk = isFinite(g.capy.position.y);
      res[bn] = r;
    }
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=wf.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
