async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);

  const out = {};

  const crowdPts = () => {
    const g = window.__capy;
    const pts = [];
    for (const b of g.world.bodies) {
      if (b.type !== 2 || !b.shapes.length) continue;
      let all = true;
      for (const s of b.shapes) {
        if (!s.halfExtents || Math.abs(s.halfExtents.x - 0.26) > 1e-6 ||
            Math.abs(s.halfExtents.y - 0.85) > 1e-6) { all = false; break; }
      }
      if (!all || b.position.y < -800) continue;
      for (let k = 0; k < b.shapes.length; k++) {
        const o = b.shapeOffsets[k];
        pts.push([b.position.x + o.x, b.position.y + o.y, b.position.z + o.z]);
      }
    }
    return pts;
  };

  // ---- HANOI: do the sitter boxes stand on top of the stools? -------------
  out.hanoi = await page.evaluate(async (fnSrc) => {
    const g = window.__capy;
    const crowdPts = eval('(' + fnSrc + ')');
    g.biome.switchTo('hanoi');
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false);
    const crowd = crowdPts();
    // every DYNAMIC body small enough to be a stool
    const st = [];
    for (const b of g.world.bodies) {
      if (b.type === 2 || !b.shapes.length) continue;
      const s = b.shapes[0];
      if (!s.halfExtents) continue;
      if (s.halfExtents.y > 0.35 || s.halfExtents.x > 0.35) continue;
      if (b.position.y < -800) continue;
      st.push([b.position.x, b.position.z]);
    }
    let worst = 1e9, near = 0;
    for (const s of st) {
      let d = 1e9;
      for (const c of crowd) {
        const dx = c[0] - s[0], dz = c[2] - s[1];
        const dd = Math.sqrt(dx * dx + dz * dz);
        if (dd < d) d = dd;
      }
      if (d < worst) worst = d;
      if (d < 0.9) near++;
    }
    return { crowdShapes: crowd.length, smallDynamic: st.length,
             minStoolToPerson: st.length ? +worst.toFixed(2) : null,
             stoolsInsideAPerson: near };
  }, crowdPts.toString());

  // ---- VENICE: is the passerelle clear once the boards are out? -----------
  out.venice = await page.evaluate(async (fnSrc) => {
    const g = window.__capy, CANNON = g.CANNON;
    const crowdPts = eval('(' + fnSrc + ')');
    g.biome.switchTo('venice');
    const api = g.venice || {};
    let ticks = 0;
    for (; ticks < 60 * 300; ticks++) {
      g.tick(1 / 60, false);
      if (api.boardsOut && api.boardsOut() > 0.95) break;
    }
    for (let i = 0; i < 240; i++) g.tick(1 / 60, false);   // let them get on
    const b0 = api.boards ? api.boards() : null;
    const crowd = crowdPts();
    // how many crowd boxes are standing on the plank deck. The deck is at
    // venCITY_Y + venBOARD_Y; a box on it sits ~0.85 above that.
    let onDeck = 0;
    if (b0) for (const c of crowd) if (Math.abs(c[1] - (b0.y + 0.85)) < 0.35) onDeck++;
    return { ticks: ticks, boardsOut: api.boardsOut ? +api.boardsOut().toFixed(2) : null,
             tide: api.tide ? +api.tide().toFixed(2) : null,
             crowdShapesLive: crowd.length, boxesOnTheDeck: onDeck,
             deckY: b0 ? +b0.y.toFixed(2) : null };
  }, crowdPts.toString());

  await page.evaluate(async (o) => {
    await fetch('/shot?name=v36-risk.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
