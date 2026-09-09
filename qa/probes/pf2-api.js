async page => {
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 4500)));
  // start the game from the title card with a real key
  await page.keyboard.press('Digit1');
  await page.evaluate(() => new Promise(r => setTimeout(r, 3500)));
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const t = v => typeof v;
    const res = {
      have: !!g,
      started: g && g.state && g.state.started,
      biome: g && g.state && g.state.biome,
      err: g && g.state && g.state.lastError ? String(g.state.lastError) : null,
      api: {},
      nums: {}
    };
    if (!g) return res;
    res.api.loaf = g.capy ? t(g.capy.loaf) : 'no capy';
    res.api.loafAsk = g.capy ? t(g.capy.loafAsk) : 'no capy';
    res.api.restT = g.capy ? t(g.capy.restT) : 'no capy';
    res.api.spawnKeep = g.physics ? t(g.physics.spawnKeep) : 'no physics';
    res.api.rescue = g.physics ? t(g.physics.rescue) : 'no physics';
    res.api.typeOf = g.physics ? t(g.physics.typeOf) : 'no physics';
    res.api.calmAudit = g.hud ? t(g.hud.calmAudit) : 'no hud';
    res.api.photoAudit = g.hud ? t(g.hud.photoAudit) : 'no hud';
    res.api.roomAudit = g.hud ? t(g.hud.roomAudit) : 'no hud';
    res.api.calm = t(g.calm);
    res.api.addCritter = t(g.addCritter);
    res.api.noticed = t(g.noticed);
    res.api.locals = g.locals ? ('array len ' + g.locals.length) : 'none';
    try {
      const ca = g.hud && g.hud.calmAudit ? g.hud.calmAudit() : null;
      res.nums.calm = ca && ca.calm;
      res.nums.loaf = ca && ca.loaf;
      res.nums.critters = ca && ca.critters ? ca.critters.length : null;
      res.nums.critterKeys = ca && ca.critters && ca.critters[0] ? Object.keys(ca.critters[0]).join(',') : null;
    } catch (e) { res.nums.calmErr = String(e); }
    res.nums.tasksTotal = g.tasks ? g.tasks.length : null;
    res.nums.chapters = g.chapters ? g.chapters.length : null;
    return res;
  });
  const b = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=pf2-api.json', { method: 'POST', body: s }), b);
}
