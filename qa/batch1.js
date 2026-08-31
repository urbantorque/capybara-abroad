async page => {
  const out = { tag: 'BATCH1' };

  const biomeNow = async () => page.evaluate(() => {
    const g = window.__capy;
    return g && g.biome ? g.biome.current : null;
  });

  const enter = async (key, want) => {
    await page.reload();
    await page.waitForTimeout(5500);
    await page.keyboard.press(key);
    for (let i = 0; i < 25; i++) {
      await page.waitForTimeout(1000);
      const b = await biomeNow();
      if (b === want) { await page.waitForTimeout(2000); return true; }
    }
    return false;
  };

  out.sydneyReached = await enter('Digit1', 'sydney');

  out.A = await page.evaluate(() => {
    const g = window.__capy;
    const r = { biome: g.biome.current };
    const f = g.env && g.env.ferry;
    if (!f || !f.body) { r.err = 'no ferry'; return r; }
    r.gangway = [+f.gangwayX.toFixed(2), +f.gangwayZ.toFixed(2)];
    const x0 = f.body.position.x, z0 = f.body.position.z;
    r.atBuild = [+x0.toFixed(3), +z0.toFixed(3)];
    let worst = 0;
    for (let i = 0; i < 240; i++) {
      g.tick(1 / 60, false);
      const d = Math.hypot(f.body.position.x - x0, f.body.position.z - z0);
      if (d > worst) worst = d;
    }
    r.after4s = [+f.body.position.x.toFixed(3), +f.body.position.z.toFixed(3)];
    r.driftFromStartM = +worst.toFixed(3);
    r.lastError = g.state.lastError || null;
    return r;
  });

  out.hanoiReached = await enter('Slash', 'hanoi');

  out.B = await page.evaluate(() => {
    const g = window.__capy;
    const r = { biome: g.biome.current };
    const root = g.scene.getObjectByName('hanoi');
    if (!root) { r.err = 'no hanoi root'; return r; }
    const meshes = [];
    root.traverse(o => { if (o.isMesh) meshes.push(o); });
    const y0 = meshes.map(o => o.rotation.y);
    const py = meshes.map(o => o.position.y);
    for (let i = 0; i < 360; i++) g.tick(1 / 60, false);
    let moved = 0, maxd = 0;
    for (let i = 0; i < meshes.length; i++) {
      const d = Math.abs(meshes[i].rotation.y - y0[i]);
      if (d > 0.05) moved++;
      if (d > maxd) maxd = d;
    }
    r.meshes = meshes.length;
    r.rotatedOver0p05 = moved;
    r.maxYawDriftRad = +maxd.toFixed(3);
    let bobI = -1, bobA = 0;
    for (let i = 0; i < meshes.length; i++) {
      const d = Math.abs(meshes[i].position.y - py[i]);
      if (d > bobA) { bobA = d; bobI = i; }
    }
    if (bobI >= 0) {
      const sh = meshes[bobI];
      let prevX = sh.position.x, prevZ = sh.position.z, jump = 0;
      for (let i = 0; i < 900; i++) {
        g.tick(1 / 60, false);
        const dj = Math.hypot(sh.position.x - prevX, sh.position.z - prevZ);
        if (dj > jump) jump = dj;
        prevX = sh.position.x; prevZ = sh.position.z;
      }
      r.bobberMaxStepM = +jump.toFixed(3);
      r.bobberAmpM = +bobA.toFixed(2);
    }
    r.lastError = g.state.lastError || null;
    return r;
  });

  out.veniceReached = await enter('Digit0', 'venice');

  out.C = await page.evaluate(() => {
    const g = window.__capy;
    const r = { biome: g.biome.current };
    const moored = g.scene.getObjectByName('venMoored');
    const trag = g.scene.getObjectByName('venTraghetto');
    r.haveMoored = !!moored; r.haveTrag = !!trag;
    if (!moored || !trag) return r;
    const fm = moored.children && moored.children[0];
    if (fm && fm.geometry) {
      fm.geometry.computeBoundingBox();
      const box = fm.geometry.boundingBox;
      r.mooredBoxX = [+box.min.x.toFixed(1), +box.max.x.toFixed(1)];
      r.mooredBoxZ = [+box.min.z.toFixed(1), +box.max.z.toFixed(1)];
      r.mooredBoxYlocal = [+box.min.y.toFixed(2), +box.max.y.toFixed(2)];
      r.mooredVerts = fm.geometry.attributes.position.count;
    }
    r.tragXZ = [+trag.position.x.toFixed(1), +trag.position.z.toFixed(1)];
    r.tide0 = +g.venice.tide().toFixed(3);
    r.mooredY0 = +moored.position.y.toFixed(3);
    r.tragY0 = +trag.position.y.toFixed(3);
    return r;
  });

  out.tideWalk = [];
  for (let chunk = 0; chunk < 9; chunk++) {
    const row = await page.evaluate(() => {
      const g = window.__capy;
      for (let i = 0; i < 800; i++) g.tick(1 / 60, false);
      const moored = g.scene.getObjectByName('venMoored');
      const trag = g.scene.getObjectByName('venTraghetto');
      return {
        tide: +g.venice.tide().toFixed(3),
        mooredY: moored ? +moored.position.y.toFixed(3) : null,
        tragY: trag ? +trag.position.y.toFixed(3) : null,
        err: g.state.lastError || null,
      };
    });
    out.tideWalk.push(row);
  }

  out.E = await page.evaluate(() => {
    const g = window.__capy;
    return { biome: g.biome.current, lastError: g.state.lastError || null,
             bodies: g.world.bodies.length };
  });

  await page.evaluate(payload => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 1))));
    return fetch('/shot?name=batch1-result.json', { method: 'POST', body: s });
  }, out);
}
