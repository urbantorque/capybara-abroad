async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(3000);
  const snap = () => page.evaluate(() => {
    const g = window.__capy;
    let boards = 0;
    for (const b of g.world.bodies) if (b.mass === 0 && b.shapes && b.shapes.length === 1 && b.shapes[0].halfExtents && Math.abs(b.shapes[0].halfExtents.x - b.shapes[0].halfExtents.x) === 0) boards++;
    return { biome: g.biome.current, bodies: g.world.bodies.length, objs: g.scene.children.length, camDist: (g.hud && g.hud.camInfo) ? g.hud.camInfo() : null };
  });
  const rows = [];
  rows.push(Object.assign({ step: 'start' }, await snap()));
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => { const g = window.__capy; g.biome.switchTo('quay'); return true; });
    await wait(1500);
    await page.evaluate(() => { const g = window.__capy; g.biome.switchTo('sydney'); return true; });
    await wait(1500);
    rows.push(Object.assign({ step: 'roundtrip ' + (i + 1) }, await snap()));
  }
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), { rows });
  await page.evaluate(s => fetch('/shot?name=rv-board.json', { method: 'POST', body: s }), bl);
}
