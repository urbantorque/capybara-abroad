async page => {
  const KEYS = [['Digit1','sydney'],['Minus','kowloon']];
  for (let i = 0; i < KEYS.length; i++) {
    await page.reload();
    await page.waitForTimeout(4500);
    await page.keyboard.press(KEYS[i][0]);
    await page.waitForTimeout(6000);
    const d = await page.evaluate((n) => {
      const g = window.__capy;
      g.renderer.setSize(1280, 760, false);
      g.tick(1 / 60, true);
      // A TIGHT LENS ON THE ANIMAL. The rim lives on a silhouette a hundred
      // pixels tall at the gameplay FOV; judging it there is judging a rumour.
      const f = g.camera.fov;
      g.camera.fov = 15;
      g.camera.updateProjectionMatrix();
      g.post.render();
      const png = document.querySelector('canvas').toDataURL('image/png');
      g.camera.fov = f;
      g.camera.updateProjectionMatrix();
      return { b: g.biome.current, png };
    }, KEYS[i][1]);
    await page.evaluate(async (a) => { await fetch('/shot?name=TAG-' + a[0], { method: 'POST', body: a[1] }); },
                        [KEYS[i][1], d.png]);
  }
}
