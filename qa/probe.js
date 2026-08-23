async page => {
  await page.reload();
  await page.waitForFunction(() => window.__capy && window.__capy.biome, null, { timeout: 30000 });
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'qa/z-sydney.png' });
  const info = await page.evaluate(() => {
    const g = window.__capy;
    let n = 0;
    g.scene.traverse(o => { if (o.isMesh && o.visible) n++; });
    return { meshes: n, renderCalls: g.renderer.info.render.calls,
             autoReset: g.renderer.info.autoReset };
  });
  await page.evaluate(async o => {
    await fetch('/shot?name=probe.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, info);
}
