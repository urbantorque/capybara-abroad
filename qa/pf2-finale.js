async page => {
  const ids = await page.evaluate(async () => {
    const r = await fetch('/qa/all-task-ids.json');
    return await r.json();
  });
  // Write a COMPLETE journey, then reload once. Not addInitScript: that fires on
  // every navigation and would wipe the very file we are testing (harness trap 10).
  await page.evaluate(o => {
    localStorage.clear();
    localStorage.setItem('capy3.journey.v1', JSON.stringify({
      v: 1, tasks: o.ids, seen: o.seen, recs: {}, told: 1,
      ms: 3600000, chapms: {}, finds: [], foundAt: {}, biome: 'sydney', fin: 0
    }));
  }, { ids: ids, seen: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17] });
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 4500)));
  const out = { taskCount: ids.length, api: {}, steps: [] };
  await page.keyboard.press('Digit1');
  await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));

  out.afterStart = await page.evaluate(() => {
    const g = window.__capy;
    return {
      started: !!g.state.started,
      done: typeof g.tasksDone === 'function' ? g.tasksDone() : null,
      biome: g.biome && g.biome.current,
      capy: g.capy && g.capy.position
        ? { x: +g.capy.position.x.toFixed(2), z: +g.capy.position.z.toFixed(2) } : null,
      teleport: typeof (g.capy && g.capy.teleport),
      stageKeep: typeof (g.physics && g.physics.stageKeep),
      err: g.state.lastError ? String(g.state.lastError) : null
    };
  });

  // Where did the seventeen actually end up?
  out.keeps = await page.evaluate(() => {
    const g = window.__capy;
    const ps = (g.physics && g.physics.list && g.physics.list()) || null;
    const arr = [];
    // no list() export? walk the scene for the keep meshes via the props array if exposed
    const src = ps || (g.props || []);
    for (let i = 0; i < src.length; i++) {
      const p = src[i];
      if (p && p.keep && !p.removed) {
        arr.push({ keep: p.keep,
                   x: +p.body.position.x.toFixed(2),
                   y: +p.body.position.y.toFixed(2),
                   z: +p.body.position.z.toFixed(2),
                   homeY: +(p.homeY || 0).toFixed(2) });
      }
    }
    return { n: arr.length, list: arr };
  });
  const b = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=pf2-finale.json', { method: 'POST', body: s }), b);
}
