async page => {
  await page.reload();
  await page.waitForTimeout(5500);
  const a = await page.evaluate(() => {
    const g = window.__capy;
    g.renderer.setSize(1280, 760, false);
    g.tick(1 / 60, true);
    return document.querySelector('canvas').toDataURL('image/png');
  });
  await page.evaluate(async d => { await fetch('/shot?name=pol-syd-after', { method: 'POST', body: d }); }, a);
}
