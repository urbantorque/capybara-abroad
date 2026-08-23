async page => {
  await page.setViewportSize({width:1280, height:800});
  await page.waitForFunction(() => !!window.__capy && !!window.__capy.biome, null, {timeout: 20000});
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', {code:'Space', key:' ', bubbles:true})); });
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('venice');
    for (let i=0;i<120;i++) g.tick(1/60,false);
  });
  await page.keyboard.press('Tab');
  await page.waitForTimeout(900);
  await page.screenshot({path:'qa/T-board.png'});
}
