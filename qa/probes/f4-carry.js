async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(4000);
  const out = {};
  // Venice has locals with owned props and is a chapter the errand runs in.
  await page.evaluate(() => { window.__capy.biome.switchTo('venice'); return true; });
  await wait(4000);
  // Drive the errand directly: pick an owned prop, put it on the ground away
  // from home, and let the owner come and get it.
  out.setup = await page.evaluate(() => {
    const g = window.__capy;
    const KIN = 4, DYN = 1, STA = 2;   // CANNON.Body type ids
    const owned = [];
    for (const p of g.props) {
      if (!p || !p.body || p.held || p.removed) continue;
      if (p.homeX === undefined) continue;
      owned.push(p);
    }
    return { props: g.props.length, candidates: owned.length,
             types: owned.slice(0, 8).map(p => p.type + ':' + p.body.type) };
  });
  // Move ONE prop a few metres from its home and let the world run.
  out.run = await page.evaluate(async () => {
    const g = window.__capy;
    const p = g.props.find(x => x && x.body && !x.held && !x.removed && x.homeX !== undefined &&
                                x.grabbable !== false);
    if (!p) return { noProp: true };
    const t0 = p.body.type;
    p.body.position.set(p.homeX + 5, p.homeY + 1.2, p.homeZ + 5);
    p.body.velocity.set(0, 0, 0);
    p.settled = false;
    const rows = [];
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 700));
      const owner = g.locals ? g.locals.find(L => L && L.carry === p) : null;
      rows.push({ t: +(i * 0.7).toFixed(1),
                  type: p.body.type, owner: !!p.owner, carried: !!owner,
                  dHome: +Math.hypot(p.body.position.x - p.homeX, p.body.position.z - p.homeZ).toFixed(2) });
    }
    // ...and THE THING THAT MATTERS: is it left pinned?
    return { type0: t0, typeEnd: p.body.type, ownerEnd: !!p.owner,
             everCarried: rows.some(r => r.carried),
             everKinematic: rows.some(r => r.type === 4),
             backHome: rows[rows.length - 1].dHome < 1.5,
             rows: rows.filter((r, i) => i % 4 === 0 || r.carried) };
  });
  // ...and a chapter change while somebody might be mid-carry.
  await page.evaluate(() => { window.__capy.biome.switchTo('sydney'); return true; });
  await wait(2500);
  await page.evaluate(() => { window.__capy.biome.switchTo('venice'); return true; });
  await wait(3000);
  out.afterTravel = await page.evaluate(() => {
    const g = window.__capy;
    let kin = 0, owned = 0, tot = 0;
    for (const p of g.props) {
      if (!p || !p.body || p.held) continue;
      tot++;
      if (p.body.type === 4) kin++;
      if (p.owner) owned++;
    }
    const carrying = g.locals ? g.locals.filter(L => L && L.carry).length : -1;
    return { props: tot, kinematic: kin, owned: owned, localsCarrying: carrying };
  });
  out.err = await page.evaluate(() => window.__capy.state.lastError ? String(window.__capy.state.lastError) : null);
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f4-carry.json', { method: 'POST', body: s }), bl);
}
