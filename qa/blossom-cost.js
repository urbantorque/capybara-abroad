async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(7000);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const r = g.renderer;
    // info.render.calls does NOT include the shadow pass while autoReset is on
    // -- three resets after the shadow map -- and reading it after post.render()
    // gives the composite quad and nothing else. Render the SCENE and read it.
    const keepSh = r.shadowMap.enabled;
    r.shadowMap.enabled = false;
    r.info.autoReset = false;
    r.info.reset();
    r.setRenderTarget(null);
    r.render(g.scene, g.camera);
    const calls = r.info.render.calls, tris = r.info.render.triangles;
    r.info.autoReset = true;
    r.shadowMap.enabled = keepSh;
    return { biome: g.biome.current, calls: calls, tris: tris,
             err: g.state.lastError || null };
  });
  await page.evaluate(o => fetch('/shot?name=blossomcost.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
