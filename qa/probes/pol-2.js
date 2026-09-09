async page => {
  await page.reload();
  await page.waitForTimeout(5000);
  const r = await page.evaluate(() => {
    const g = window.__capy;
    const gl = g.renderer.getContext();
    const cam = g.camera;
    const capy = g.capy;
    return {
      bw: gl.drawingBufferWidth, bh: gl.drawingBufferHeight,
      dpr: window.devicePixelRatio, pr: g.renderer.getPixelRatio(),
      fov: cam.fov, camY: cam.position.y, camX: cam.position.x, camZ: cam.position.z,
      capyY: capy && capy.pos ? capy.pos.y : null,
      capyX: capy && capy.pos ? capy.pos.x : null,
      capyZ: capy && capy.pos ? capy.pos.z : null,
      composite: !!g.composer,
      keys: Object.keys(g).slice(0, 40),
    };
  });
  await page.evaluate((o) => fetch('/shot?name=pol-2.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), r);
}
