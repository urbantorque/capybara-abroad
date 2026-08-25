async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch(e){} });
  await page.reload();
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);
  const out = await page.evaluate(() => {
    const g = window.__capy; const o = { lines: [], sfx: {} };
    const park = (x,y,z) => { const b=g.capy.body; b.position.set(x,y,z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
    g.biome.switchTo('rio'); park(0,1.4,0);
    for (let i=0;i<120;i++) g.tick(1/60,false);
    const osfx = g.sfx.bind(g);
    g.sfx = function(n,op){ o.sfx[n]=(o.sfx[n]||0)+1; return osfx(n,op); };
    const locals = g.locals.filter(x=>x.biome==='rio');
    o.pairSep = [];
    const seen = new Set();
    // stand between the globo man and the kiosk
    park(-1.5, 0.4, -5.5);
    for (let i=0;i<60*90;i++) {
      g.tick(1/60,false);
      for (const l of locals) {
        if (l.bub && l.bub.text && !seen.has(l.bub.text)) { seen.add(l.bub.text);
          o.lines.push({ t:+(i/60).toFixed(1), x:+l.x.toFixed(0), z:+l.z.toFixed(0),
                         d:+Math.hypot(l.x+1.5, l.z+5.5).toFixed(1), s:l.bub.text.slice(0,54) }); }
      }
    }
    o.locals = locals.map(l=>({x:+l.x.toFixed(1), z:+l.z.toFixed(1), near:l.near, hasFig:!!l.fig,
                               keys:Object.keys(l).filter(k=>/bub|say|line|txt/i.test(k))}));
    o.err = g.state.lastError || null;
    return o;
  });
  await page.evaluate((o) => fetch('/shot?name=rio10.json', { method:'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
