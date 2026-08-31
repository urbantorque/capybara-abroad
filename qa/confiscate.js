async page => {
  await page.reload();
  await page.waitForTimeout(5500);
  await page.keyboard.press('Digit1');
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(1000);
    const b = await page.evaluate(() => {
      const g = window.__capy;
      return g && g.biome ? g.biome.current : null;
    });
    if (b === 'sydney') break;
  }
  await page.waitForTimeout(2000);

  const out = await page.evaluate(() => {
    const g = window.__capy;
    const r = { biome: g.biome.current };
    const ph = g.physics;
    r.hasRelease = typeof ph.release === 'function';
    r.hasDropOwned = typeof ph.dropOwned === 'function';

    const prop = (g.props || []).find(p => p && p.grabbable && !p.removed && !p.held);
    if (!prop) { r.err = 'no grabbable prop'; return r; }
    r.propType = prop.type;

    const capy = g.capy;
    capy.body.position.set(prop.body.position.x, prop.body.position.y + 0.6,
                           prop.body.position.z);
    capy.body.velocity.set(0, 0, 0);
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);

    const grabbed = ph.grab ? ph.grab(prop) : null;
    for (let i = 0; i < 5; i++) g.tick(1 / 60, false);
    r.grabReturned = grabbed === undefined ? 'undefined' : String(grabbed);
    r.heldAfterGrab = !!(capy.heldProp) && capy.heldProp === prop;
    r.propHeldFlag = !!prop.held;

    if (!r.heldAfterGrab) { r.note = 'could not grab; rest of test skipped'; return r; }

    ph.dropOwned();
    for (let i = 0; i < 5; i++) g.tick(1 / 60, false);
    r.stillHeldAfterBareDropOwned = !!(capy.heldProp);

    ph.dropOwned(prop);
    for (let i = 0; i < 5; i++) g.tick(1 / 60, false);
    r.stillHeldAfterDropOwnedWithProp = !!(capy.heldProp);

    ph.release(null);
    for (let i = 0; i < 10; i++) g.tick(1 / 60, false);
    r.heldAfterRelease = !!(capy.heldProp);
    r.propHeldFlagAfterRelease = !!prop.held;
    r.lastError = g.state.lastError || null;
    return r;
  });

  await page.evaluate(payload => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 1))));
    return fetch('/shot?name=confiscate-result.json', { method: 'POST', body: s });
  }, out);
}
