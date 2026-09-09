async page => {
  const out = { tag: 'BATCH2B', gates: [], sahRepeat: [], soak: [] };

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

  const gatePlan = [['Slash', 'hanoi'], ['Period', 'monaco']];
  for (const pair of gatePlan) {
    const ok = await enter(pair[0], pair[1]);
    if (!ok) { out.gates.push({ want: pair[1], err: 'never arrived' }); continue; }
    const row = await page.evaluate(wanted => {
      const g = window.__capy;
      const r = { biome: g.biome.current, want: wanted };
      r.hasIsActive = typeof g.biome.isActive === 'function';
      r.isActiveSelf = r.hasIsActive ? !!g.biome.isActive(wanted) : null;
      r.isActiveOther = r.hasIsActive ? !!g.biome.isActive('sydney') : null;
      let threw = null;
      try {
        for (let i = 0; i < 6; i++) {
          g.events.emit('capy:wheek', { position: g.capy.position, soft: false });
          for (let k = 0; k < 30; k++) g.tick(1 / 60, false);
        }
      } catch (e) { threw = String(e && e.message || e); }
      r.wheekThrew = threw;
      r.lastError = g.state.lastError || null;
      return r;
    }, pair[1]);
    out.gates.push(row);
  }

  for (let rep = 0; rep < 2; rep++) {
    const ok = await enter('Digit8', 'sahara');
    if (!ok) { out.sahRepeat.push({ err: 'never arrived' }); continue; }
    const row = await page.evaluate(() => {
      const g = window.__capy;
      const root = g.scene.getObjectByName('sahara');
      let casters = 0, flagged = 0, meshes = 0;
      root.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return;
        meshes++;
        if (o.castShadow) casters++;
        if (o.userData && o.userData.noShadow) flagged++;
      });
      const st = g.scene.getObjectByName('sahStorks');
      return { meshes, casters, flagged,
               storksCast: st ? !!st.castShadow : null,
               storksFlag: st ? !!(st.userData && st.userData.noShadow) : null };
    });
    out.sahRepeat.push(row);
  }

  const soakPlan = [['Digit4', 'kyoto'], ['Digit5', 'cali'], ['Digit6', 'rio'],
                    ['Digit7', 'iceland'], ['Equal', 'palawan'], ['Period', 'monaco'],
                    ['Slash', 'hanoi']];
  for (const pair of soakPlan) {
    const ok = await enter(pair[0], pair[1]);
    if (!ok) { out.soak.push({ want: pair[1], err: 'never arrived' }); continue; }
    const row = await page.evaluate(wanted => {
      const g = window.__capy;
      let nan = 0;
      for (let c = 0; c < 3; c++) {
        for (let i = 0; i < 600; i++) g.tick(1 / 60, false);
        const p = g.capy && g.capy.position;
        if (p && (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z))) nan++;
      }
      return { want: wanted, biome: g.biome.current, bodies: g.world.bodies.length,
               nan: nan, lastError: g.state.lastError || null };
    }, pair[1]);
    out.soak.push(row);
  }

  await page.evaluate(payload => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 1))));
    return fetch('/shot?name=batch2b-result.json', { method: 'POST', body: s });
  }, out);
}
