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

    g.biome.switchTo('quay');
    await sleep(500);
    const q = g.quay;
    const b = g.capy.body;
    b.position.set(q.boat.helm.x, q.boat.position.y + 1.2, q.boat.helm.z);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    g.capy.position.copy(b.position);
    await sleep(300);
    down('KeyE'); await sleep(90); up('KeyE'); await sleep(300);
    res.atHelm = q.boat.atHelm;

    // She lies bow-SOUTH at the berth with the wharf to port, so any passage
    // starts astern. Back her out, then head up the fairway and hold station in
    // it: the Freshwater is on a 129 s round trip over the same water, so a
    // head-on pass is a matter of waiting rather than of chasing.
    down('KeyS');
    for (let i = 0; i < 240; i++) await sleep(30);
    up('KeyS');

    function steerTo(tx, tz) {
      const bp = q.boat.position;
      const bear = Math.atan2(tx - bp.x, tz - bp.z);
      let d = bear - q.boat.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      up('KeyA'); up('KeyD');
      if (d > 0.05) down('KeyA'); else if (d < -0.05) down('KeyD');
    }

    let hailed = false, minR = 1e9;
    const track = [];
    down('KeyW');
    for (let i = 0; i < 5200; i++) {
      await sleep(30);
      const bp = q.boat.position;
      const r = q.freshwaterRange();
      minR = Math.min(minR, r);
      if (i % 120 === 0) track.push({ t: (i * 0.03) | 0, r: +r.toFixed(0),
                                      bz: +bp.z.toFixed(0), fz: +q.freshwater().z.toFixed(0) });
      if (bp.z > -300) steerTo(90, -420);
      else { up('KeyW'); steerTo(q.freshwater().x, q.freshwater().z); }
      if (!hailed && r < 72) {
        hailed = true;
        res.hailRange = +r.toFixed(1);
        down('KeyQ'); await sleep(80); up('KeyQ');
      }
      if (hailed && done['ferry-salute']) { res.tickAt = +(i * 0.03).toFixed(1); break; }
    }
    up('KeyW'); up('KeyA'); up('KeyD');
    res.hailed = hailed;
    res.minRange = +minR.toFixed(1);
    res.ticked = !!done['ferry-salute'];
    res.track = track;
    // the wash: it arrives ten and a half seconds after her reply
    const heel = [];
    for (let i = 0; i < 340; i++) {
      await sleep(50);
      const grp = g.scene.getObjectByName('quayBoat');
      const e = new g.THREE.Euler().setFromQuaternion(
        grp ? grp.quaternion : g.camera.quaternion, 'YXZ');
      heel.push(Math.abs(+e.z.toFixed(3)));
    }
    res.maxHeel = Math.max.apply(null, heel);
    res.errs = errs;
    res.lastError = g.state && g.state.lastError;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=mini1b.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
