async page => {
  await page.reload();
  await page.waitForTimeout(4500);
  await page.keyboard.press('KEYX');
  await page.waitForTimeout(6000);
  const d = await page.evaluate(() => {
    const g = window.__capy;
    g.renderer.setSize(1280, 760, false);
    g.tick(1 / 60, true);
    return { b: g.biome.current, e: g.state.lastError ? String(g.state.lastError) : null,
             png: document.querySelector('canvas').toDataURL('image/png'),
             tris: g.renderer.info.render.triangles, calls: g.renderer.info.render.calls };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=NAMEX', { method: 'POST', body: o.png });
    await fetch('/shot?name=NAMEX.json', { method: 'POST',
      body: btoa(JSON.stringify({ b: o.b, e: o.e, tris: o.tris, calls: o.calls })) });
  }, d);
}
