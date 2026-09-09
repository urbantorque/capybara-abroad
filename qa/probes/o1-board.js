async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2000);
  const ids10 = ["to-venice","spritz-theft","pigeon-storm","passerelle","the-well","the-calli","gondola-ride","rialto","acqua-alta","mirror-swim","traghetto","volo","pigeons-back","flooded-cafe"];
  const out = await page.evaluate(async (ids) => {
    const g = window.__capy;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    g.biome.switchTo('venice');
    tick(90);
    const rec = (g.locals || []).filter(l => l.biome === 'venice' &&
      l.lines && String(l.lines[0]).indexOf('Gondola, gondola') >= 0)[0];
    const api = g.venice;
    // two visits, so the board shows a MIDDLE tier and not a finished one
    for (let v = 0; v < 2; v++) {
      g.biome.switchTo('venice'); tick(30);
      const px = rec.x + 2.4, pz = rec.z;
      g.capy.body.position.set(px, api.terrainHeight(px, pz) + 0.35, pz);
      g.capy.body.velocity.set(0, 0, 0);
      tick(60 * 45);
      if (v === 0) { g.biome.switchTo('kyoto'); tick(60 * 5); }
    }
    for (const id of ids) { try { g.completeTask(id); } catch (e) {} }
    tick(240);
    const el = document.querySelector('.capyui-clue');
    return { tier: g.palDebug().tier, board: el ? el.textContent : null };
  }, ids10);
  await page.evaluate(() => {
    let alive = true;
    const loop = () => { if (!alive) return; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    window.__pinStop = () => { alive = false; };
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'qa/O1-board.png', clip: { x: 0, y: 0, width: 470, height: 400 } });
  await page.evaluate(() => { if (window.__pinStop) window.__pinStop(); });
  await page.evaluate((o) => fetch('/shot?name=o1-board.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
