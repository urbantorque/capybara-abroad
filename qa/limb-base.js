async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(4000);
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click(); });
  await page.waitForTimeout(6000);
  const started = await page.evaluate(() => !!(window.__capy && window.__capy.state.started));
  const out = { started, rows: [] };
  for (const b of ['sydney', 'sahara', 'kowloon', 'venice', 'pasto']) {
    await page.evaluate(n => { window.__capy.hud.cross(n); }, b);
    await page.waitForTimeout(9000);
    const r = await page.evaluate(async () => {
      const g = window.__capy;
      g.renderer.info.autoReset = false;
      g.renderer.info.reset();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const calls = g.renderer.info.render.calls, tris = g.renderer.info.render.triangles;
      g.renderer.info.autoReset = true;
      let people = 0;
      g.scene.traverse(o => { if (o.isMesh && o.visible) people++; });
      return { biome: g.biome.current, calls: Math.round(calls / 2), tris: Math.round(tris / 2),
               meshes: people, err: g.state.lastError || null };
    });
    out.rows.push(r);
  }
  await page.evaluate(o => fetch('/shot?name=limbbase.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
