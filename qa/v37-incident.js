async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);

  await page.evaluate(() => {
    window.__inc = [];
    window.__capy.events.on('capy:incident', (p) => {
      window.__inc.push({ n: p.n, tier: p.tier, saw: p.saw });
    });
    window.__cards = [];
    window.__sweepCard = () => {
      const k = document.querySelector('.capyui-momentkick');
      const t = document.querySelector('.capyui-momenttext');
      const el = document.querySelector('.capyui-moment');
      if (el && el.classList.contains('show') && k && k.textContent) {
        const s = k.textContent + ' | ' + (t ? t.textContent : '');
        if (window.__cards[window.__cards.length - 1] !== s) window.__cards.push(s);
      }
    };
  });

  // A REAL PROP, HIT AT A REAL SPEED, WHERE PEOPLE ARE. props.js's own emit is
  // not simulated — the payload is exactly the one it builds — but the barging
  // is, because steering a capybara into three bins headlessly is a different
  // probe. Everything downstream of the event is the shipped code.
  const RUN = `(async (o) => {
    const g = window.__capy;
    window.__inc.length = 0; window.__cards.length = 0;
    if (g.biome.current !== o.biome) {
      g.biome.switchTo(o.biome);
      const sp = g.biome.spawnOf(o.biome);
      if (sp) { g.capy.body.position.set(sp.x, sp.y + 0.6, sp.z); g.capy.body.velocity.setZero(); }
      for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    }
    // stand the animal where the people are
    g.capy.body.position.set(o.x, o.y, o.z);
    g.capy.body.velocity.setZero();
    g.capy.body.previousPosition.copy(g.capy.body.position);
    g.capy.body.interpolatedPosition.copy(g.capy.body.position);
    for (let i = 0; i < 60; i++) { g.tick(1 / 60, false); window.__sweepCard(); }

    const props = (g.props || []).filter(p => p && p.body && !p.hidden &&
      Math.hypot(p.body.position.x - o.x, p.body.position.z - o.z) < 30);
    const out = { props: props.length, heat: g.npcHeat ? g.npcHeat(o.x, o.z, 16) : -1, steps: [] };
    for (let k = 0; k < o.hits; k++) {
      const p = props[k % props.length];
      if (!p) break;
      p.disturbed = true;
      p.lastCapyTouch = g.state.time;
      // put it next to the animal so the chain's "one place" test is met
      p.body.position.set(o.x + (k % 2 ? 2 : -2), o.y, o.z + (k < 2 ? 2 : -2));
      p.body.previousPosition.copy(p.body.position);
      p.body.interpolatedPosition.copy(p.body.position);
      g.events.emit('prop:impact', {
        prop: p, speed: 5.5, position: p.body.position,
        voice: 'thud', vpitch: 1, vgain: 1,
      });
      out.steps.push({ hit: k + 1, heat: g.npcHeat ? g.npcHeat(o.x, o.z, 16) : -1,
                       near: (g.locals || []).filter(L => L && L.biome === o.biome && Math.hypot(L.x - o.x, L.z - o.z) < 16).length + (g.npcs || []).filter(q => q && q.group && Math.hypot(q.group.position.x - o.x, q.group.position.z - o.z) < 16).length,
                       incidents: window.__inc.length });
      for (let i = 0; i < 42; i++) { g.tick(1 / 60, false); window.__sweepCard(); }
    }
    for (let i = 0; i < 120; i++) { g.tick(1 / 60, false); window.__sweepCard(); }
    out.incidents = window.__inc.slice();
    out.cards = window.__cards.slice();
    return out;
  })`;

  const out = {};
  // Venice: forty-eight people on the paving, and they are solid now.
  out.venice = await page.evaluate(RUN + '({biome:"venice",x:-4,y:1.4,z:-6,hits:7})');
  // ...and Sydney, which has no locals at all and goes down the other route.
  out.sydney = await page.evaluate(RUN + '({biome:"sydney",x:-4,y:1.0,z:20,hits:7})');
  // The same prop over and over is ONE thing happening, not seven.
  out.sameProp = await page.evaluate(`(async () => {
    const g = window.__capy;
    window.__inc.length = 0;
    const p = (g.props || []).find(q => q && q.body && !q.hidden);
    const c = g.capy.body.position;
    for (let k = 0; k < 8; k++) {
      p.disturbed = true; p.lastCapyTouch = g.state.time;
      p.body.position.set(c.x + 1.5, c.y, c.z + 1.5);
      g.events.emit('prop:impact', { prop: p, speed: 5.5, position: p.body.position });
      for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
    }
    return { incidents: window.__inc.length };
  })()`);

  // ---- the three rules that keep it from being noise ----------------------
  out.rules = await page.evaluate(`(async () => {
    const g = window.__capy;
    const bang = (x, z) => {
      const p = (g.props || []).find(q => q && q.body && !q.hidden &&
        Math.hypot(q.body.position.x - x, q.body.position.z - z) < 40);
      if (!p) return false;
      p.disturbed = true; p.lastCapyTouch = g.state.time;
      p.body.position.set(x + (Math.random() - 0.5) * 3, g.capy.body.position.y, z + (Math.random() - 0.5) * 3);
      g.events.emit('prop:impact', { prop: p, speed: 5.5, position: p.body.position });
      p.id = (p.id | 0) + 1000;      // a different prop each time
      return true;
    };
    const r = {};

    // 1. A COOLDOWN. Let the chain lapse, then do three more straight away.
    window.__inc.length = 0;
    for (let i = 0; i < 60 * 14; i++) g.tick(1 / 60, false);   // window (12 s) lapses
    const c = g.capy.body.position;
    for (let k = 0; k < 4; k++) { bang(c.x, c.z); for (let i = 0; i < 36; i++) g.tick(1 / 60, false); }
    r.rightAfter = window.__inc.length;

    // 2. NOBODY WATCHING, NOTHING HAPPENS. Same chapter, same props, same
    //    bangs — the animal is simply somewhere nobody is. The border clears
    //    the cooldown (see the biome:enter handler) so this is not confounded
    //    by the run above it.
    g.biome.switchTo('venice');
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    g.biome.switchTo('sydney');
    for (let i = 0; i < 150; i++) g.tick(1 / 60, false);
    const near = (x, z) => (g.npcs || []).filter(q => q && q.group &&
        Math.hypot(q.group.position.x - x, q.group.position.z - z) < 16).length +
      (g.locals || []).filter(L => L && L.biome === 'sydney' &&
        Math.hypot(L.x - x, L.z - z) < 16).length;
    // find a corner of the gardens with nobody in it
    let ax = 0, az = 0, best = 999;
    for (let gx = -70; gx <= 30; gx += 10) for (let gz = 0; gz <= 90; gz += 10) {
      const n = near(gx, gz);
      if (n < best) { best = n; ax = gx; az = gz; }
    }
    g.capy.body.position.set(ax, 1.0, az); g.capy.body.velocity.setZero();
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    window.__inc.length = 0;
    for (let k = 0; k < 6; k++) { bang(ax, az); for (let i = 0; i < 36; i++) g.tick(1 / 60, false); }
    r.aloneAt = [ax, az];
    r.alonePeople = near(ax, az);
    r.aloneIncidents = window.__inc.length;
    return r;
  })()`);

  await page.evaluate(async (o) => {
    await fetch('/shot?name=v37-incident.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
