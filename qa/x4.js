async page => {
  await page.waitForFunction(() => !!window.__capy, null, {timeout: 25000});
  await page.waitForTimeout(1000);
  await page.keyboard.press(']');           // start at Manly
  await page.waitForTimeout(2600);
  // let the set come round, then stand between the flags
  await page.evaluate(() => {
    const g = window.__capy;
    for (let i=0;i<60*90 && !g.manly.seenSet(); i++) g.tick(1/60,false);
    g.capy.body.position.set(6, 2.0, 30); g.capy.body.velocity.set(0,0,0);
    for (let i=0;i<60;i++) g.tick(1/60,false);
  });
  await page.waitForTimeout(400);
  for (let i = 0; i < 3; i++) { await page.keyboard.press('q'); await page.waitForTimeout(260); }
  await page.waitForTimeout(700);
  const a = await page.evaluate(() => ({
    board: document.querySelector('.capyui-jr').classList.contains('show'),
    foot: (document.querySelector('.capyui-jrfoot')||{}).textContent || '',
  }));
  await page.keyboard.press('2');
  await page.waitForTimeout(3200);
  const b = await page.evaluate(() => {
    const g = window.__capy;
    const done = [...document.querySelectorAll('.capyui-task.done')].map(e => e.textContent.slice(0,32));
    return { biome: g.biome.current, done, err: g.state.lastError || null,
             pos: [+g.capy.body.position.x.toFixed(1), +g.capy.body.position.y.toFixed(2), +g.capy.body.position.z.toFixed(1)] };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=result.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))});
  }, {a, b});
}
