async page => {
  const KEYS = [['Slash','hanoi'],['Digit5','cali']];
  for (let i = 0; i < KEYS.length; i++) {
    await page.reload();
    await page.waitForTimeout(4500);
    await page.keyboard.press(KEYS[i][0]);
    await page.waitForTimeout(6500);
    const d = await page.evaluate((n) => {
      const g = window.__capy;
      g.renderer.setSize(1280, 760, false);
      g.tick(1 / 60, true);
      let tris = 0;
      g.scene.traverse((o) => {
        if (!o.visible || !o.geometry) return;
        const gg = o.geometry, c = gg.index ? gg.index.count : (gg.attributes.position ? gg.attributes.position.count : 0);
        tris += (c / 3) * (o.isInstancedMesh ? o.count : 1);
      });
      return { b: g.biome.current, want: n, e: g.state.lastError ? String(g.state.lastError) : null,
               tris: Math.round(tris), png: document.querySelector('canvas').toDataURL('image/png') };
    }, KEYS[i][1]);
    await page.evaluate(async (o) => {
      await fetch('/shot?name=pol-' + o.want, { method: 'POST', body: o.png });
      await fetch('/shot?name=pol-' + o.want + '.json', { method: 'POST',
        body: btoa(JSON.stringify({ b: o.b, e: o.e, tris: o.tris })) });
    }, d);
  }
}
