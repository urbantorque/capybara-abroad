async page => {
  await page.reload(); await page.waitForTimeout(6500);
  await page.mouse.click(500, 400);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = {};
    const KEYS = ['KeyW','KeyA','KeyS','KeyD','Space','KeyE','KeyQ','ShiftLeft','KeyF'];
    const down = (c) => window.dispatchEvent(new KeyboardEvent('keydown', {code:c, bubbles:true}));
    const up = (c) => window.dispatchEvent(new KeyboardEvent('keyup', {code:c, bubbles:true}));
    let seed = 12345; const rnd = () => { seed = (seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; };
    for (const bn of ['venice','kowloon','palawan']) {
      g.state.lastError = null;
      g.biome.switchTo(bn);
      for (let i=0;i<90;i++) g.tick(1/60,false);
      const r = { nan:0, under:0, err:null, y:[], tasks:0 };
      const held = new Set();
      for (let i=0;i<9000;i++) {
        if (i % 17 === 0) {
          for (const k of held) up(k); held.clear();
          const n = 1 + (rnd()*3|0);
          for (let j=0;j<n;j++) { const k = KEYS[rnd()*KEYS.length|0]; held.add(k); down(k); }
        }
        try { g.tick(1/60,false); } catch(e) { r.err = String(e && e.message); break; }
        const p = g.capy.position;
        if (!isFinite(p.x)||!isFinite(p.y)||!isFinite(p.z)) { r.nan++; break; }
        if (p.y < -40) r.under++;
        if (i%1500===0) r.y.push([+p.x.toFixed(1),+p.y.toFixed(1),+p.z.toFixed(1)]);
      }
      for (const k of held) up(k);
      r.lastError = g.state.lastError || null;
      r.bodies = g.world.bodies.length;
      res[bn] = r;
    }
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=w1.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
