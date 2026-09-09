async page => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.mouse.click(400, 400);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'qa-shot-play.png' });
  // the journal, with the controls open
  await page.keyboard.press('h');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'qa-shot-journal.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  // the bare window
  await page.keyboard.press('p');
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'qa-shot-bare.png' });
  await page.keyboard.press('p');
  await page.waitForTimeout(900);
  // a vertical chapter, to see the height tell
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('drift');
    const sp = g.biome.spawnOf('drift'), b = g.capy.body;
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'qa-shot-drift.png' });
  const aim = await page.evaluate(() => [...document.querySelectorAll('.capyui-aim')].map(a => a.textContent).filter(Boolean));
  await page.evaluate(async (o) => { await fetch('/shot?name=shotnew.json', { method: 'POST', body: btoa(JSON.stringify(o)) }); }, aim);
}
