async page => {
  const out = { tag: 'BATCH3' };

  const enter = async (key, want) => {
    await page.reload();
    await page.waitForTimeout(5500);
    await page.keyboard.press(key);
    for (let i = 0; i < 25; i++) {
      await page.waitForTimeout(1000);
      const b = await page.evaluate(() => {
        const g = window.__capy;
        return g && g.biome ? g.biome.current : null;
      });
      if (b === want) { await page.waitForTimeout(2000); return true; }
    }
    return false;
  };

  // ---- A. the seaplane, over a full cycle --------------------------------
  out.planeReached = await enter('Digit1', 'sydney');
  let carry = null, maxJump = 0, samples = 0;
  for (let chunk = 0; chunk < 4; chunk++) {
    const r = await page.evaluate(prev => {
      const g = window.__capy;
      const pl = g.scene.getObjectByName('seaplane');
      if (!pl) return { err: 'no seaplane' };
      // START FROM WHERE IT IS NOW, never from the previous chunk's last
      // sample: real time passes between page.evaluate calls and rAF keeps
      // flying the aeroplane, so a carried reference reports that real-time
      // drift as a one-tick jump. (Measured: it invented a 1.0 m "jump".)
      let px = pl.position.x;
      let pz = pl.position.z;
      let py = pl.position.y;
      if (prev && prev.unused) { px = prev.x; py = prev.y; pz = prev.z; }
      let mj = 0, n = 0;
      for (let i = 0; i < 1600; i++) {
        g.tick(1 / 60, false);
        const d = Math.hypot(pl.position.x - px, pl.position.y - py, pl.position.z - pz);
        if (d > mj) mj = d;
        px = pl.position.x; py = pl.position.y; pz = pl.position.z;
        n++;
      }
      return { maxJump: mj, x: px, y: py, z: pz, n: n };
    }, carry);
    if (r.err) { out.planeErr = r.err; break; }
    if (r.maxJump > maxJump) maxJump = r.maxJump;
    samples += r.n;
    carry = { x: r.x, y: r.y, z: r.z };
  }
  out.plane = { maxPerTickJumpM: +maxJump.toFixed(3), ticks: samples };

  // ---- B. would a whole-scene spill scan pick up a detached chapter? ------
  out.spill = await page.evaluate(() => {
    const g = window.__capy;
    const r = {};
    g.biome.switchTo('kowloon');
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    g.biome.switchTo('sydney');
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    r.live = g.biome.current;
    const kow = g.scene.getObjectByName('kowloon');
    r.kowloonRootVisible = kow ? kow.visible : null;
    // How many of a DETACHED chapter's meshes still say visible:true?
    let kowMeshes = 0, kowVisible = 0, kowEmissive = 0;
    if (kow) {
      kow.traverse(o => {
        if (!o.isMesh) return;
        kowMeshes++;
        if (o.visible) kowVisible++;
        const m = o.material;
        if (o.visible && m && m.emissive) {
          const ei = m.emissiveIntensity === undefined ? 1 : m.emissiveIntensity;
          const lum = (0.2126 * m.emissive.r + 0.7152 * m.emissive.g + 0.0722 * m.emissive.b) * ei;
          if (lum >= 0.22) kowEmissive++;
        }
      });
    }
    r.detachedMeshes = kowMeshes;
    r.detachedStillVisibleTrue = kowVisible;
    r.detachedBrightEmissive = kowEmissive;
    // the two scan scopes, counted the way sysSpillScan counts
    const count = root => {
      let n = 0;
      root.traverse(o => {
        if (!o.isMesh || !o.visible) return;
        const m = o.material;
        if (!m || !m.emissive) return;
        const ei = m.emissiveIntensity === undefined ? 1 : m.emissiveIntensity;
        const lum = (0.2126 * m.emissive.r + 0.7152 * m.emissive.g + 0.0722 * m.emissive.b) * ei;
        if (lum >= 0.22) n++;
      });
      return n;
    };
    r.oldScopeWholeScene = count(g.scene);
    const envRoot = g.scene.getObjectByName('environment');
    r.newScopeLiveChapter = envRoot ? count(envRoot) : null;
    return r;
  });

  await page.evaluate(payload => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 1))));
    return fetch('/shot?name=batch3-result.json', { method: 'POST', body: s });
  }, out);
}
