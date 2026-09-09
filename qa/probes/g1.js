async page => {
  await page.setViewportSize({width:1280, height:760});
  await page.waitForFunction(() => !!window.__capy, null, {timeout: 25000});
  await page.waitForTimeout(900);
  const shots = [
    [']', 'G-manly-play', 400],
    [';', 'G-pantanal-play', 400],
    ["'", 'G-cave-play', 400],
  ];
  // start at Manly
  await page.keyboard.press(']');
  await page.waitForTimeout(2600);
  await page.evaluate(() => { const g=window.__capy; g.capy.body.position.set(0,2.4,28); g.capy.body.velocity.set(0,0,0); for(let i=0;i<200;i++) g.tick(1/60,false); });
  await page.waitForTimeout(400);
  await page.screenshot({path:'qa/G-manly-play.png'});
  await page.evaluate(() => { const g=window.__capy; g.biome.switchTo('pantanal'); const s=g.biome.spawnOf('pantanal'); g.capy.body.position.set(s.x,s.y,s.z); g.capy.body.velocity.set(0,0,0); for(let i=0;i<220;i++) g.tick(1/60,false); });
  await page.waitForTimeout(500);
  await page.screenshot({path:'qa/G-pantanal-play.png'});
  await page.evaluate(() => { const g=window.__capy; g.biome.switchTo('cave'); g.capy.body.position.set(6,-4,-10); g.capy.body.velocity.set(0,0,0); for(let i=0;i<220;i++) g.tick(1/60,false); });
  await page.waitForTimeout(500);
  await page.screenshot({path:'qa/G-cave-dark.png'});
  await page.keyboard.press('q');
  await page.waitForTimeout(180);
  await page.screenshot({path:'qa/G-cave-echo.png'});
}
