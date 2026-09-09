async page => {
  const out = {};
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(1500);
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
  // ---- KEEPSAKES: make all seventeen and look at them
  out.made = await page.evaluate(() => {
    const g = window.__capy;
    const places = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift','venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic'];
    const made = [];
    const c = g.capy.position;
    for (let i = 0; i < places.length; i++) {
      const a = i * 2.4, r = 1.5 + i * 0.25;
      const p = g.physics.spawnKeep(places[i], c.x + Math.cos(a) * r, c.z + Math.sin(a) * r);
      made.push({ place: places[i], ok: !!p, type: p && p.type, biome: p && p.biome,
                  mass: p && p.mass, hy: p && +p.originY.toFixed(3),
                  vis: p && p.mesh.visible, tris: p && p.mesh.geometry.attributes.position.count / 3 });
    }
    return made;
  });
  await page.waitForTimeout(2500);
  out.settled = await page.evaluate(() => {
    const ps = window.__capy.props.filter(p => p.keep);
    return ps.map(p => ({ k: p.keep, y: +p.body.position.y.toFixed(2), vis: p.mesh.visible,
                          inWorld: window.__capy.world.bodies.indexOf(p.body) >= 0 }));
  });
  // ---- ...and now travel, twice, and see if they came
  await page.evaluate(() => window.__qaGo('venice'));
  await page.waitForTimeout(2500);
  out.afterVenice = await page.evaluate(() => {
    const ps = window.__capy.props.filter(p => p.keep);
    const c = window.__capy.capy.position;
    let far = 0, vis = 0, inW = 0;
    for (const p of ps) {
      const d = Math.hypot(p.body.position.x - c.x, p.body.position.z - c.z);
      if (d > far) far = d;
      if (p.mesh.visible) vis++;
      if (window.__capy.world.bodies.indexOf(p.body) >= 0) inW++;
    }
    return { n: ps.length, visible: vis, inWorld: inW, furthestFromCapy: +far.toFixed(1) };
  });
  await page.evaluate(() => window.__qaGo('cave'));
  await page.waitForTimeout(2500);
  out.afterCave = await page.evaluate(() => {
    const ps = window.__capy.props.filter(p => p.keep);
    const c = window.__capy.capy.position;
    let far = 0, vis = 0, under = 0;
    for (const p of ps) {
      const d = Math.hypot(p.body.position.x - c.x, p.body.position.z - c.z);
      if (d > far) far = d;
      if (p.mesh.visible) vis++;
      if (p.body.position.y < -50) under++;
    }
    return { n: ps.length, visible: vis, furthestFromCapy: +far.toFixed(1), fellThrough: under };
  });
  out.calls = await page.evaluate(() => window.__capy.renderer.info.render.calls);
  out.err = await page.evaluate(() => String(window.__capy.state.lastError));
  await page.evaluate((o) => fetch('/shot?name=w34i.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
