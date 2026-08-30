async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Equal');
  await page.waitForTimeout(7000);
  await page.evaluate(async () => {
    const g = window.__capy;
    const c = g.canvas || g.renderer.domElement;
    const P = g.post.params;
    const keep = P.exposure;
    for (const [tag, e] of [['off', 1.0], ['on', keep]]) {
      P.exposure = e;
      g.post.render();
      await fetch('/shot?name=PALEXP-' + tag, { method: 'POST', body: c.toDataURL('image/png') });
    }
    P.exposure = keep;
  });
}
