async page => {
  await page.reload(); await page.waitForTimeout(5600);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = {};
    const hold=(x,y,z)=>{const b=g.capy.body;b.position.set(x,y,z);b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);};
    g.biome.switchTo('sahara');
    for (let i=0;i<300;i++) g.tick(1/60,false);
    const S = g.sahara;
    // rob the cart to start the chase
    hold(S.cart.x + 1.4, 1.0, S.cart.z + 1.4);
    for (let i=0;i<40;i++){ g.input.actionPressed = true; g.tick(1/60,false); }
    res.cart = g.taskDone('orange-cart');
    res.chasing = S.chasing();
    // run into the souk and hide
    for (let i=0;i<60*30;i++){ hold(S.souk.x, 1.0, S.souk.z); g.tick(1/60,false); }
    res.escaped = g.taskDone('souk-escape');
    res.err = g.state.lastError || null;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=y7sah5.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
