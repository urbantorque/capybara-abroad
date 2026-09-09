async page => {
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(6500);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const p = g.post && g.post.params;
    const cu = null;
    return {
      biome: g.biome && g.biome.current,
      postEnabled: !!(g.post && g.post.enabled),
      lastError: g.state.lastError || null,
      dof: p && p.dof, dofFar0: p && +p.dofFar0.toFixed(2),
      dofFar1: p && +p.dofFar1.toFixed(2),
      dofNear0: p && +p.dofNear0.toFixed(2), dofNear1: p && +p.dofNear1.toFixed(2),
      air: p && p.air, airMax: p && p.airMax, crease: p && p.crease,
      airCol: p && [+p.airR.toFixed(3), +p.airG.toFixed(3), +p.airB.toFixed(3)],
      camNear: g.camera.near, camFar: g.camera.far, fov: g.camera.fov,
      capyDist: g.capy ? +Math.hypot(
        g.capy.position.x - g.camera.position.x,
        g.capy.position.y - g.camera.position.y,
        g.capy.position.z - g.camera.position.z).toFixed(2) : null,
    };
  });
  await page.screenshot({ path: 'qa/DEPTH-01-sydney.png' });
  // ...and the same frame with every depth term cut, for the A/B.
  await page.evaluate(() => { window.__capy.state.noDepth = true; });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'qa/DEPTH-01-sydney-OFF.png' });
  await page.evaluate(() => { window.__capy.state.noDepth = false; });
  const errs = await page.evaluate(() => window.__capy.state.lastError || null);
  out.errAfter = errs;
  await page.evaluate(o => fetch('/shot?name=depthsmoke.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
