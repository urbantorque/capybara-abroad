async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2000);
  const out = {};
  // A. THE LINE, IN THE WORLD. Stand beside the gondolier until he says it,
  //    then hold the frame long enough to photograph the bubble.
  out.a = await page.evaluate(async () => {
    const g = window.__capy;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    g.biome.switchTo('venice');
    tick(90);
    const rec = (g.locals || []).filter(l => l.biome === 'venice' &&
      l.lines && String(l.lines[0]).indexOf('Gondola, gondola') >= 0)[0];
    const api = g.venice;
    const px = rec.x + 2.6, pz = rec.z + 0.6;
    g.capy.body.position.set(px, api.terrainHeight(px, pz) + 0.35, pz);
    g.capy.body.velocity.set(0, 0, 0);
    // three visits' worth of tiers, earned the honest way, so the line on
    // screen is the one with the nickname in it
    const said = [];
    const real = rec.anchor.speak;
    rec.anchor.speak = function (t) { said.push(t); return real.call(this, t); };
    for (let v = 0; v < 3; v++) {
      for (let i = 0; i < 60 * 45; i++) g.tick(1 / 60, false);
      if (v < 2) {
        g.biome.switchTo('kyoto'); tick(60 * 5);
        g.biome.switchTo('venice'); tick(20);
        g.capy.body.position.set(px, api.terrainHeight(px, pz) + 0.35, pz);
        g.capy.body.velocity.set(0, 0, 0);
      }
    }
    return { tier: g.palDebug().tier, said };
  });
  // ...and now hold the frame while he says the tier line, with the camera on him
  await page.evaluate(async () => {
    const g = window.__capy;
    const rec = (g.locals || []).filter(l => l.biome === 'venice' &&
      l.lines && String(l.lines[0]).indexOf('Gondola, gondola') >= 0)[0];
    rec.talkCd = 0;
    g.palArm(3);
    let alive = true;
    const loop = () => { if (!alive) return; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    window.__pinStop = () => { alive = false; };
    for (let i = 0; i < 130; i++) g.tick(1 / 60, false);
  });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'qa/O1-line.png' });
  await page.evaluate(() => { if (window.__pinStop) window.__pinStop(); });
  // B. THE RECORD BOARD. Every task in Venice ticked, so the paper turns into
  //    the board, and the regular's line is on it.
  // Chapter 10’s fourteen task ids, so the paper turns into the record board.
  const ids10 = ["to-venice","spritz-theft","pigeon-storm","passerelle","the-well","the-calli","gondola-ride","rialto","acqua-alta","mirror-swim","traghetto","volo","pigeons-back","flooded-cafe"];
  out.b = await page.evaluate(async (ids) => {
    const g = window.__capy;
    let done = 0;
    for (const id of ids) { try { g.completeTask(id); done++; } catch (e) {} }
    for (let i = 0; i < 300; i++) g.tick(1 / 60, false);
    const el = document.querySelector('.capyui-clue');
    return { done, n: ids.length, board: el ? el.textContent : null };
  }, ids10);
  await page.evaluate((o) => fetch('/shot?name=o1-shot.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
