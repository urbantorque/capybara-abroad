async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(7000);
  await page.evaluate(async () => {
    const g = window.__capy, s = g.state, cam = g.camera;
    const c = g.canvas || g.renderer.domElement;
    const cp = g.capy.position;
    // 135 degrees was the backlit azimuth in qa/leaf-orbit.js. The camera is
    // placed AFTER the tick so nothing can move it between the two arms.
    const a = 135 * Math.PI / 180, R = 11, H = 6.2;
    for (const off of [true, false]) {
      s.noLeaf = off;
      g.tick(0, false);
      cam.position.set(cp.x + Math.sin(a) * R, cp.y + H, cp.z + Math.cos(a) * R);
      cam.lookAt(cp.x, cp.y + 0.6, cp.z);
      cam.updateMatrixWorld(true);
      g.post.render();
      await fetch('/shot?name=LEAFSYD-' + (off ? 'off' : 'on'),
                  { method: 'POST', body: c.toDataURL('image/png') });
    }
    s.noLeaf = false;
  });
}
