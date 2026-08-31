async page => {
  const out = { tag: 'BATCH2', rows: [] };
  const plan = [
    ['Digit4', 'kyoto'],
    ['Digit5', 'cali'],
    ['Digit6', 'rio'],
    ['Digit7', 'iceland'],
    ['Digit8', 'sahara'],
    ['Equal', 'palawan'],
  ];

  for (const pair of plan) {
    const key = pair[0], want = pair[1];
    await page.reload();
    await page.waitForTimeout(5500);
    await page.keyboard.press(key);
    let got = null;
    for (let i = 0; i < 25; i++) {
      await page.waitForTimeout(1000);
      got = await page.evaluate(() => {
        const g = window.__capy;
        return g && g.biome ? g.biome.current : null;
      });
      if (got === want) break;
    }
    if (got !== want) { out.rows.push({ want: want, reached: got, err: 'never arrived' }); continue; }
    await page.waitForTimeout(2000);

    const row = await page.evaluate(wanted => {
      const g = window.__capy;
      const root = g.scene.getObjectByName(wanted);
      const r = { want: wanted, biome: g.biome.current };
      if (!root) { r.err = 'no root'; return r; }
      let casters = 0, flagged = 0, flaggedButCasting = 0, meshes = 0;
      root.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return;
        meshes++;
        if (o.castShadow) casters++;
        if (o.userData && o.userData.noShadow) {
          flagged++;
          if (o.castShadow) flaggedButCasting++;
        }
      });
      r.meshes = meshes;
      r.casters = casters;
      r.flagged = flagged;
      r.flaggedButStillCasting = flaggedButCasting;
      const named = {};
      ['caliLoros', 'caliKites', 'sahStorks', 'rioFragatas', 'palSchools'].forEach(n => {
        const o = g.scene.getObjectByName(n);
        if (o) named[n] = { cast: !!o.castShadow, flag: !!(o.userData && o.userData.noShadow) };
      });
      if (Object.keys(named).length) r.named = named;
      if (wanted === 'palawan') {
        const fish = g.scene.getObjectByName('palSchools');
        if (fish && fish.material) {
          r.fishRimHook = Object.prototype.hasOwnProperty.call(fish.material, 'onBeforeCompile');
          r.fishCacheKey = Object.prototype.hasOwnProperty.call(fish.material, 'customProgramCacheKey');
        }
      }
      r.lastError = g.state.lastError || null;
      return r;
    }, want);
    out.rows.push(row);
  }

  await page.evaluate(payload => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 1))));
    return fetch('/shot?name=batch2-result.json', { method: 'POST', body: s });
  }, out);
}
