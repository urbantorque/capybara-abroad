async page => {
  const out = await page.evaluate(async () => {
    const errs = [];
    const oldErr = console.error;
    console.error = function (...a) { errs.push(a.map(x => (x && x.stack) || String(x)).join(' ')); oldErr.apply(console, a); };
    window.addEventListener('error', e => errs.push('WINDOW ' + (e.message || e.error)));
    const g = window.__capy;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const res = {};
    const btns = document.querySelectorAll('.capyui-pick');
    if (btns[0]) btns[0].click();
    await sleep(600);
    const done = Object.create(null);
    g.events.on('task:complete', p => { if (p && p.id) done[p.id] = true; });
    const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
    const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
    const tap = async k => { down(k); await sleep(80); up(k); await sleep(80); };
    function place(x, y, z) {
      const b = g.capy.body;
      b.position.set(x, y, z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.capy.position.set(x, y, z);
    }

    // ---------------- DRIFT: the seed ----------------
    g.biome.switchTo('drift');
    await sleep(600);
    const d = g.drift;
    res.hasSeed = typeof d.seed === 'function';
    let sp = d.seed();
    place(sp.x, sp.y, sp.z);
    await sleep(250);
    await tap('KeyE');
    res.onSeed = d.onSeed();
    const seedTrail = [];
    for (let i = 0; i < 700; i++) {
      await sleep(60);
      if (i % 40 === 0) seedTrail.push({ y: +g.capy.position.y.toFixed(1), on: d.onSeed(), ride: +d.seedRide().toFixed(0) });
      if (done['driftseed']) break;
      if (!d.onSeed() && i < 3) { sp = d.seed(); place(sp.x, sp.y, sp.z); await sleep(200); await tap('KeyE'); }
    }
    res.driftTicked = !!done['driftseed'];
    res.seedTrail = seedTrail.slice(0, 10);

    // ---------------- VENICE: the traghetto ----------------
    g.biome.switchTo('venice');
    await sleep(600);
    const v = g.venice;
    res.hasTrag = typeof v.traghetto === 'function';
    let tp = v.traghetto();
    place(tp.x, tp.y + 1.4, tp.z);
    await sleep(500);
    res.onTrag = v.onTraghetto();
    for (let i = 0; i < 900; i++) {
      await sleep(60);
      if (done['traghetto']) break;
      // stay put in the middle of the boat rather than fighting the lean
      if (i % 12 === 0 && !v.onTraghetto()) { tp = v.traghetto(); place(tp.x, tp.y + 1.2, tp.z); }
    }
    res.venTicked = !!done['traghetto'];

    // ---------------- HONG KONG: the open top ----------------
    g.biome.switchTo('kowloon');
    await sleep(600);
    const hk = g.kowloon;
    res.hasBus = typeof hk.bus === 'function';
    let bp = hk.bus();
    place(bp.x, bp.y + 5.4, bp.z);
    await sleep(500);
    res.onBus = hk.onBusTop();
    for (let i = 0; i < 800; i++) {
      await sleep(60);
      if (done['bus-top']) break;
    }
    res.hkTicked = !!done['bus-top'];

    // ---------------- PALAWAN: the bait ball ----------------
    g.biome.switchTo('palawan');
    await sleep(600);
    const pa = g.palawan;
    res.hasBall = typeof pa.baitBall === 'function';
    const bb = pa.baitBall();
    place(bb.x, bb.y, bb.z);
    for (let i = 0; i < 220; i++) {
      await sleep(60);
      if (done['bait-ball']) break;
      if (i % 8 === 0) place(bb.x, bb.y, bb.z);
      down('KeyE');   // hold the dive so it stays down
    }
    up('KeyE');
    res.palTicked = !!done['bait-ball'];

    // ---------------- CAPPADOCIA: the herd ----------------
    g.biome.switchTo('goreme');
    await sleep(600);
    const go = g.goreme;
    res.hasMare = typeof go.mare === 'function';
    let mp = go.mare();
    place(mp.x, mp.y + 2.0, mp.z);
    await sleep(500);
    res.onMare = go.onMare();
    const mareTrail = [];
    for (let i = 0; i < 700; i++) {
      await sleep(60);
      if (i % 40 === 0) mareTrail.push({ on: go.onMare(), run: go.mareRunning(), z: +go.mare().z.toFixed(0), cy: +g.capy.position.y.toFixed(1) });
      if (done['the-herd']) break;
    }
    res.mareTrail = mareTrail;
    res.gorTicked = !!done['the-herd'];
    res.errs = errs;
    res.lastError = g.state && g.state.lastError;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=mini4.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
