async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(6500);
  await page.keyboard.press('Space');
  await page.waitForTimeout(3000);
  for (const b of ['quay', 'sahara']) {
    await page.evaluate((n) => { const g = window.__capy; try { g.hud.cross(n); } catch (e) { g.biome.switchTo(n); } }, b);
    await page.waitForTimeout(4500);
    const at = await page.evaluate(() => {
      const g = window.__capy;
      function rootOf(o){let r=null;for(let p=o;p;p=p.parent)r=p;return r;}
      function shown(o){for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;}
      const L = g.locals.filter(r=>r.group&&rootOf(r.group)===g.scene&&shown(r.group));
      if(!L.length) return null;
      let best=null,bn=-1;
      for(const a of L){let k=0;for(const c of L) if(Math.hypot(a.x-c.x,a.z-c.z)<12)k++; if(k>bn){bn=k;best=a;}}
      return { x: best.x, z: best.z };
    });
    if (!at) continue;
    await page.evaluate((o) => {
      const g = window.__capy;
      const f = g[o.b] && g[o.b].terrainHeight;
      const th = f ? f(o.x, o.z) : 0;
      const y = (th === th ? th : 0) + 1.0;
      if (window.__pin) clearInterval(window.__pin);
      window.__pin = setInterval(function () {
        const bd = g.capy && g.capy.body;
        if (bd) { bd.position.set(o.x + 4.5, y, o.z + 4.5); bd.velocity.set(0,0,0); bd.angularVelocity.set(0,0,0); }
        if (g.input) g.input.camYaw = Math.atan2(-4.5, -4.5);
      }, 16);
    }, { b: b, x: at.x, z: at.z });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'qa/BIO-legs-' + b + '.png' });
    await page.evaluate(() => { if (window.__pin) clearInterval(window.__pin); });
  }
}
