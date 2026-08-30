async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(7000);
  const out = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE;
    const c = g.canvas || g.renderer.domElement;
    // Straight down over the biggest drift, so the shape and the rim are the
    // whole picture rather than a detail at the edge of one.
    const cam = g.camera;
    const keepP = cam.position.clone(), keepQ = cam.quaternion.clone();
    cam.position.set(6.0, 12, 22.6);
    cam.up.set(0, 0, -1);
    cam.lookAt(6.0, 0, 22.6);
    cam.updateMatrixWorld(true);
    g.post.render();
    await fetch('/shot?name=BLOSSOM-top', { method: 'POST', body: c.toDataURL('image/png') });
    // ...and from the player's own angle, which is the one that matters.
    cam.up.set(0, 1, 0);
    cam.position.set(6.0, 6.2, 33.0);
    cam.lookAt(6.0, 0.2, 23.0);
    cam.updateMatrixWorld(true);
    g.post.render();
    await fetch('/shot?name=BLOSSOM-eye', { method: 'POST', body: c.toDataURL('image/png') });
    cam.position.copy(keepP); cam.quaternion.copy(keepQ);
    cam.updateMatrixWorld(true);
    const r = g.renderer.info.render;
    return { biome: g.biome.current, err: g.state.lastError || null,
             tris: r.triangles, calls: r.calls };
  });
  await page.evaluate(o => fetch('/shot?name=blossom.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
