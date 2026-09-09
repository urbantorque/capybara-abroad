async page => {
  await page.reload();
  await page.waitForTimeout(5500);
  await page.keyboard.press('Digit0');
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(1000);
    const b = await page.evaluate(() => {
      const g = window.__capy;
      return g && g.biome ? g.biome.current : null;
    });
    if (b === 'venice') break;
  }
  await page.waitForTimeout(2000);

  for (let chunk = 0; chunk < 8; chunk++) {
    await page.evaluate(() => {
      const g = window.__capy;
      for (let i = 0; i < 800; i++) g.tick(1 / 60, false);
    });
  }

  const info = await page.evaluate(() => {
    const g = window.__capy;
    const moored = g.scene.getObjectByName('venMoored');
    const trag = g.scene.getObjectByName('venTraghetto');
    const capy = g.capy;
    if (trag && capy && capy.body) {
      capy.body.position.set(trag.position.x + 9, trag.position.y + 3.5, trag.position.z + 9);
      capy.body.velocity.set(0, 0, 0);
    }
    return {
      tide: +g.venice.tide().toFixed(3),
      mooredY: moored ? +moored.position.y.toFixed(3) : null,
      tragXZ: trag ? [+trag.position.x.toFixed(1), +trag.position.z.toFixed(1)] : null,
      err: g.state.lastError || null,
    };
  });

  await page.waitForTimeout(3000);

  await page.evaluate(payload => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 1))));
    return fetch('/shot?name=shots-info.json', { method: 'POST', body: s });
  }, info);
}
