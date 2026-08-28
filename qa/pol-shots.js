async page => {
  const KEYS = [['Digit4','kyoto'],['Equal','palawan'],['Digit0','venice'],['Period','monaco']];
  for (let i = 0; i < KEYS.length; i++) {
    await page.reload();
    await page.waitForTimeout(4500);
    await page.keyboard.press(KEYS[i][0]);
    await page.waitForTimeout(6000);
    const d = await page.evaluate((n) => {
      const g = window.__capy;
      if (g.biome.current !== n) return 'WRONG:' + g.biome.current;
      g.renderer.setSize(1280, 760, false);
      g.tick(1 / 60, true);
      return document.querySelector('canvas').toDataURL('image/png');
    }, KEYS[i][1]);
    await page.evaluate(async (a) => {
      await fetch('/shot?name=pol-' + a[0], { method: 'POST', body: a[1] });
    }, [KEYS[i][1], d]);
  }
}
