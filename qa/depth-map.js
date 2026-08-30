async page => {
  const KEYS = ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9',
                'Digit0','Minus','Equal','BracketLeft','BracketRight','Semicolon','Quote',
                'Comma','Period','Slash'];
  const NAMES = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                 'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic',
                 'monaco','hanoi'];
  const PICK = [0, 3, 9, 11, 14, 16, 18];
  const out = [];
  for (const i of PICK) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5200);
    await page.keyboard.press(KEYS[i]);
    await page.waitForTimeout(7000);
    const row = await page.evaluate(() => {
      const g = window.__capy, T = g.THREE;
      const cam = g.camera;
      // WHERE THE FRAME ACTUALLY IS, IN METRES, by raycasting the scene through
      // a grid of NDC points. This is the number every row of sysDEPTH is a
      // multiple of, and it had been guessed rather than measured — which is
      // why the near blur was landing in front of the visible ground.
      const rc = new T.Raycaster();
      rc.far = cam.far;
      const grid = [];
      const YS = [0.8, 0.4, 0.0, -0.4, -0.8];
      for (const ny of YS) {
        const hits = [];
        for (const nx of [-0.6, 0.0, 0.6]) {
          rc.setFromCamera({ x: nx, y: ny }, cam);
          const h = rc.intersectObjects(g.scene.children, true)
                      .filter(o => o.object && o.object.visible &&
                                   o.object.type !== 'Points');
          hits.push(h.length ? +h[0].distance.toFixed(1) : null);
        }
        grid.push({ ndcY: ny, d: hits });
      }
      let capyD = null;
      if (g.capy && g.capy.position) {
        capyD = +Math.hypot(g.capy.position.x - cam.position.x,
                            g.capy.position.y - cam.position.y,
                            g.capy.position.z - cam.position.z).toFixed(2);
      }
      const p = g.post.params;
      return { biome: g.biome.current, capyD: capyD, camY: +cam.position.y.toFixed(2),
               fov: cam.fov, far: cam.far, grid: grid,
               dofNear: [+p.dofNear0.toFixed(1), +p.dofNear1.toFixed(1)],
               dofFar: [+p.dofFar0.toFixed(1), +p.dofFar1.toFixed(1)] };
    });
    out.push(row);
  }
  await page.evaluate(o => fetch('/shot?name=depthmap.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
