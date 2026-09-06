async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(5000);
  // Count the calls at the door rather than reading the toast strip: a toast
  // can be pushed off by three more before a probe looks, and `hud.say` is the
  // exact thing the new branch calls. This is the one measurement that cannot
  // be confused with an existing toast source.
  await page.evaluate(() => {
    const g = window.__capy;
    const raw = g.hud.say;
    window.__said = [];
    g.hud.say = function (s) { window.__said.push(String(s)); return raw.apply(g.hud, arguments); };
    return true;
  });
  // Stand in the middle of the crowd, then turn the camera away from them so
  // their bubbles leave the frame while they are still within npcSAY_HEAR.
  await page.evaluate(() => {
    const g = window.__capy;
    const near = (g.locals || []).concat(g.npcs).filter(r => r && r.group &&
                  (!r.biome || r.biome === g.biome.current));
    if (!near.length) return false;
    let sx = 0, sz = 0;
    for (const r of near) { sx += r.group.position.x; sz += r.group.position.z; }
    const b = g.capy.body;
    b.position.set(sx / near.length, b.position.y + 0.5, sz / near.length);
    b.velocity.set(0, 0, 0);
    return true;
  });
  await wait(2500);
  const out = { withCrowdInFrame: [], withCameraAway: [] };
  await page.evaluate(() => { window.__said.length = 0; return true; });
  await wait(20000);
  out.withCrowdInFrame = await page.evaluate(() => window.__said.slice());
  // ...now spin the camera hard so most of them are behind it.
  await page.evaluate(() => { window.__said.length = 0; return true; });
  for (let i = 0; i < 26; i++) {
    await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true })); return true; });
    await wait(180);
    await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyZ', bubbles: true })); return true; });
    await wait(600);
  }
  out.withCameraAway = await page.evaluate(() => window.__said.slice());
  out.err = await page.evaluate(() => window.__capy.state.lastError ? String(window.__capy.state.lastError) : null);
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f4-hear2.json', { method: 'POST', body: s }), bl);
}
