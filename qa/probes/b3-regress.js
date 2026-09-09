async page => {
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0,200)));
  await page.addInitScript(() => { try { localStorage.clear() } catch(e){} });
  await page.reload();
  await page.waitForTimeout(7000);
  const out = await page.evaluate(() => {
    const g = window.__capy, o = { issues: [], rows: [] };
    const names = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                   'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic'];
    for (const n of names) {
      try {
        g.biome.switchTo(n);
        const sp = g.biome.spawnOf(n), b = g.capy.body;
        b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        g.input.x = 0; g.input.z = 0; g.input.action = false; g.input.run = false;
        for (let i=0;i<120;i++) g.tick(1/60,false);
        const a = { x:g.capy.position.x, z:g.capy.position.z };
        // random-ish input soak
        for (let i=0;i<60*20;i++) {
          if (i % 40 === 0) { g.input.x = ((i*7919)%200)/100-1; g.input.z = ((i*104729)%200)/100-1; }
          if (i % 137 === 0) g.input.action = !g.input.action;
          g.tick(1/60,false);
        }
        g.input.x=0; g.input.z=0; g.input.action=false;
        for (let i=0;i<120;i++) g.tick(1/60,false);
        const p = g.capy.position;
        const bad = !(p.x===p.x && p.y===p.y && p.z===p.z);
        o.rows.push({ n, y:+p.y.toFixed(2), nan:bad,
                      moved:+Math.hypot(p.x-a.x,p.z-a.z).toFixed(1) });
        if (bad) o.issues.push(n + ': NaN position');
        if (p.y < -60) o.issues.push(n + ': fell through the world to y ' + p.y.toFixed(1));
      } catch (e) { o.issues.push(n + ': threw ' + String(e).slice(0,120)); }
    }
    o.lastError = g.state.lastError ? String(g.state.lastError).slice(0,200) : null;
    if (o.lastError) o.issues.push('game.state.lastError: ' + o.lastError);
    return o;
  });
  out.pageErrors = errs.slice(0,10);
  await page.evaluate(async d => {
    await fetch('/shot?name=b3-regress.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(d)))) });
  }, out);
}
