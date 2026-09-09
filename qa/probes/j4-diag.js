async page => {
  await page.reload(); await page.waitForTimeout(6500);
  await page.mouse.click(500, 400);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const r = { started: g.state.started, cur: g.biome.current, pos0: {...g.capy.position} };
    g.biome.switchTo('cave');
    for (let i=0;i<180;i++) g.tick(1/60,false);
    r.cur1 = g.biome.current;
    r.pos1 = { x:g.capy.position.x, y:g.capy.position.y, z:g.capy.position.z };
    r.built = g.cave && g.cave.built();
    // walk forward
    window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyW', bubbles:true}));
    for (let i=0;i<300;i++) g.tick(1/60,false);
    window.dispatchEvent(new KeyboardEvent('keyup', {code:'KeyW', bubbles:true}));
    r.pos2 = { x:g.capy.position.x, y:g.capy.position.y, z:g.capy.position.z };
    r.camYaw = g.input.camYaw;
    r.bodyPos = { x:g.capy.body.position.x, y:g.capy.body.position.y, z:g.capy.body.position.z };
    return r;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=j4.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
