async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('monaco');
  });
  await page.waitForTimeout(3000);
  // force the costume on without walking the whole boat
  const on = await page.evaluate(() => {
    const g = window.__capy;
    g.capy.dress(true);
    const b = g.capy.body;
    b.position.set(10, 9.2, -62); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    return { dressed: g.capy.dressed, err: g.state.lastError || null };
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'qa/T1-tux-back.png' });
  // turn the camera round to get the face
  await page.evaluate(() => {
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
    down('KeyZ');
  });
  await page.waitForTimeout(1700);
  await page.evaluate(() => {
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
    up('KeyZ');
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'qa/T2-tux-turn.png' });
  // and walk toward the camera so the front is in frame
  await page.evaluate(() => {
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
    down('KeyS');
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
    up('KeyS');
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'qa/T3-tux-front.png' });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=tuxwear.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, on);
}
