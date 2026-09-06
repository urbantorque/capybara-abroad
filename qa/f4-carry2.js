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
  const census = () => page.evaluate(() => {
    const g = window.__capy;
    let kin = 0, owned = 0, tot = 0;
    for (const p of g.props) {
      if (!p || !p.body || p.held) continue;
      tot++;
      if (p.body.type === 4) kin++;
      if (p.owner) owned++;
    }
    return { props: tot, kinematic: kin, owned: owned,
             carrying: g.locals ? g.locals.filter(L => L && L.carry).length : -1 };
  });
  // THE BASELINE FIRST. Nine kinematic props in Venice means nothing without
  // knowing how many there were before anybody carried anything — `reclaim`
  // pins one the same way for the roster, and a tourist holding a hat is a
  // normal state, not a leak.
  out.sydneyBoot = await census();
  await page.evaluate(() => { window.__capy.biome.switchTo('venice'); return true; });
  await wait(4000);
  out.veniceBoot = await census();

  // Drive the REAL errand: find a prop whose home is in Venice, put it on the
  // ground away from home, and start the errand through the game's own entry
  // point rather than by poking at fields.
  out.errand = await page.evaluate(async () => {
    const g = window.__capy;
    // A prop owned by somebody standing in Venice: the same test localOwnFor
    // makes — near a local's anchor, in the live biome.
    let target = null; let owner = null;
    for (const p of g.props) {
      if (!p || !p.body || p.held || p.removed) continue;
      if (!(p.homeX === p.homeX)) continue;
      for (const L of (g.locals || [])) {
        if (!L || L.biome !== 'venice' || !L.fig) continue;
        const d = Math.hypot(p.homeX - L.ax, p.homeZ - L.az);
        if (d < 6) { target = p; owner = L; break; }
      }
      if (target) break;
    }
    if (!target) return { none: true };
    const t0 = target.body.type;
    // put it on the ground a few metres from its peg
    target.body.position.set(target.homeX + 4, target.homeY + 0.6, target.homeZ + 3);
    target.body.velocity.set(0, 0, 0);
    target.settled = false;
    owner.ownCool = 0;
    const started = g.forceErrand ? g.forceErrand(target) : 'NO HOOK';
    owner = (g.locals || []).find(L => L && L.own === target) || owner;
    const rows = [];
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 600));
      rows.push({ t: +(i * 0.6).toFixed(1), type: target.body.type,
                  carried: owner.carry === target, back: !!owner.ownBack,
                  dOwner: +Math.hypot(target.body.position.x - owner.group.position.x,
                                      target.body.position.z - owner.group.position.z).toFixed(2),
                  dHome: +Math.hypot(target.body.position.x - target.homeX,
                                     target.body.position.z - target.homeZ).toFixed(2) });
    }
    return { started: started, type0: t0, typeEnd: target.body.type,
             ownerEnd: !!target.owner, carryEnd: owner.carry === target,
             everCarried: rows.some(r => r.carried),
             homeEnd: rows[rows.length - 1].dHome,
             rows: rows.filter((r, i) => i % 3 === 0 || r.carried) };
  });
  out.afterErrand = await census();
  await page.evaluate(() => { window.__capy.biome.switchTo('sydney'); return true; });
  await wait(2200);
  await page.evaluate(() => { window.__capy.biome.switchTo('venice'); return true; });
  await wait(3000);
  out.afterTravel = await census();
  out.err = await page.evaluate(() => window.__capy.state.lastError ? String(window.__capy.state.lastError) : null);
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f4-carry2.json', { method: 'POST', body: s }), bl);
}
