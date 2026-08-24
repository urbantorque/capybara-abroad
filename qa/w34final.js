async page => {
  const out = {};
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    window.__qaGo = (name) => {
      const g = window.__capy;
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name);
      const b = g.capy.body;
      b.position.set(sp.x, sp.y, sp.z);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position);
      b.interpolatedPosition.copy(b.position);
    };
  });
  // ---- game.calm(x, z) must blend toward 1 with distance
  await page.waitForTimeout(14000);
  out.calmField = await page.evaluate(() => {
    const g = window.__capy, c = g.capy.position;
    const at = (d) => +g.calm(c.x + d, c.z).toFixed(3);
    return { global: +g.calm().toFixed(3), m0: at(0), m8: at(8), m18: at(18), m26: at(26), m60: at(60) };
  });
  // ---- and the keepsakes, after the tightened fan and the moved home
  await page.evaluate(() => {
    const g = window.__capy;
    const places = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                    'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic'];
    const c = g.capy.position;
    for (let i = 0; i < places.length; i++) {
      const a = i * 2.4, r = 1.2 + i * 0.12;
      g.physics.spawnKeep(places[i], c.x + Math.cos(a) * r, c.z + Math.sin(a) * r);
    }
  });
  await page.waitForTimeout(2000);
  const check = async (name) => {
    await page.evaluate((n) => window.__qaGo(n), name);
    await page.waitForTimeout(3000);
    return page.evaluate(() => {
      const g = window.__capy;
      const ps = g.props.filter(p => p.keep && !p.removed);
      const c = g.capy.position;
      let far = 0, vis = 0, lost = 0, home = 0;
      for (const p of ps) {
        const d = Math.hypot(p.body.position.x - c.x, p.body.position.z - c.z);
        if (d > far) far = d;
        if (p.mesh.visible) vis++;
        if (d > 40 || p.body.position.y < -30) lost++;
        if (Math.hypot(p.homeX - c.x, p.homeZ - c.z) < 12) home++;
      }
      return { n: ps.length, visible: vis, furthest: +far.toFixed(1), lost, homeNearby: home };
    });
  };
  out.drift = await check('drift');
  out.quay = await check('quay');
  out.cave = await check('cave');
  out.antarctic = await check('antarctic');
  out.err = await page.evaluate(() => String(window.__capy.state.lastError));
  await page.evaluate((o) => fetch('/shot?name=w34final.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
