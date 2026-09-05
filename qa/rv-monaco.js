async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(3000);

  const out = { monaco: [], cams: [] };
  const cross = n => page.evaluate(function (n) {
    const g = window.__capy;
    try { g.hud.cross(n); } catch (e) { g.biome.switchTo(n); }
    return true;
  }, n);
  const snapTasks = () => page.evaluate(() => {
    const g = window.__capy;
    const done = [];
    for (const id of ['to-monaco', 'chicane', 'superyacht', 'high-dive', 'black-tie', 'the-floor', 'the-wheel']) if (g.taskDone(id)) done.push(id);
    const props = (g.props || []).filter(p => p.biome === g.biome.current && p.body).map(p => ({ k: p.kind || p.type || p.name || '?', x: +p.body.position.x.toFixed(1), y: +p.body.position.y.toFixed(1), z: +p.body.position.z.toFixed(1), v: +p.body.velocity.length().toFixed(2) }));
    const wet = props.filter(p => /chicane|cone|barrier|marshal/i.test(p.k) || p.y < 0.2);
    const c = g.capy.position;
    return { t: +g.state.time.toFixed(1), done: done, doneCount: g.hud.tasksDone(), capy: [+c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1)], wet: wet.slice(0, 12), nProps: props.length };
  });
  for (let k = 0; k < 3; k++) {
    await cross('sydney');
    await wait(4000);
    await cross('monaco');
    await wait(1500);
    const a = await snapTasks();
    await wait(8000);
    const b = await snapTasks();
    out.monaco.push({ rep: k, at1_5s: a, at9_5s: b });
  }
  // Camera at arrival for manly and antarctic, twice each, plus a teleport control.
  const camSnap = () => page.evaluate(() => {
    const g = window.__capy; const c = g.camera.position, p = g.capy.position;
    const d = Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z);
    let water = null; try { water = g.biome && g.biome.api && g.biome.api.waterHeightAt ? g.biome.api.waterHeightAt(c.x, c.z) : null; } catch (e) {}
    const ci = (g.hud && g.hud.camInfo) ? g.hud.camInfo() : null;
    return { biome: g.biome.current, cam: [+c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1)], capy: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], dist: +d.toFixed(2), camMinusCapyY: +(c.y - p.y).toFixed(2), water: water, camInfo: ci, fov: +g.camera.fov.toFixed(1) };
  });
  for (const n of ['manly', 'antarctic', 'manly', 'antarctic']) {
    await cross('sydney');
    await wait(4000);
    await cross(n);
    await wait(9000);
    const s = await camSnap();
    s.how = 'cross';
    out.cams.push(s);
    await page.screenshot({ path: 'qa/RV-cam-' + n + '-' + out.cams.length + '.png' });
    await wait(6000);
    const s2 = await camSnap(); s2.how = 'cross+15s'; out.cams.push(s2);
  }
  for (const n of ['manly', 'antarctic']) {
    await page.evaluate(function (n) {
      const g = window.__capy; g.biome.switchTo(n);
      const sp = g.biome.spawnOf(n), b = g.capy.body;
      if (sp) { b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0); }
      return true;
    }, n);
    await wait(6000);
    const s = await camSnap(); s.how = 'teleport'; out.cams.push(s);
    await page.screenshot({ path: 'qa/RV-cam-' + n + '-tp.png' });
  }
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=rv-monaco.json', { method: 'POST', body: s }), bl);
}
