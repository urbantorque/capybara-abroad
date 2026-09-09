async page => {
  await page.evaluate(async () => {
    function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
    const g = window.__capy;
    g.renderer.setSize(1280, 760, false);
    g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix();
    await sleep(600);
  });
  await page.screenshot({ path: 'qa/boot-title.png' });
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', {code:'Space', key:' ', bubbles:true})));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'qa/boot-play.png' });
  // walk about for a bit with real keys
  for (const k of ['KeyW','KeyD']) window; 
  await page.keyboard.down('w');
  await page.waitForTimeout(1800);
  await page.keyboard.up('w');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'qa/boot-walk.png' });
}
