async page => {
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200)));
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(7000);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const o = { errs: [] };
    const settle = n => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    g.biome.switchTo('cave');
    const cav = g.cave;
    o.haveCave = !!cav;
    o.api = Object.keys(cav || {}).sort();
    const d = cav.doline;
    o.doline = { x: d.x, z: d.z };
    const b = g.capy.body;
    // count task events
    let taskFires = [];
    g.events.on('task:complete', e => taskFires.push(e && e.id));
    function park(x, z, n) {
      b.position.set(x, cav.terrainHeight(x, z) + 0.8, z);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.input.x = 0; g.input.z = 0; g.input.action = false; g.input.run = false;
      settle(n || 240);
    }
    park(d.x, d.z, 400);
    const cp = g.capy.position, cam = g.camera.position;
    const dx = cam.x - cp.x, dz = cam.z - cp.z, dy = cam.y - cp.y;
    const hor = Math.hypot(dx, dz);
    o.marquee = {
      capy: [+cp.x.toFixed(2), +cp.y.toFixed(2), +cp.z.toFixed(2)],
      cam: [+cam.x.toFixed(2), +cam.y.toFixed(2), +cam.z.toFixed(2)],
      yaw: +Math.atan2(dx, dz).toFixed(3),
      yawDeg: +(Math.atan2(dx, dz) * 180 / Math.PI).toFixed(1),
      dist: +hor.toFixed(2),
      dist3: +Math.hypot(hor, dy).toFixed(2),
      pitchDeg: +(Math.atan2(dy, hor) * 180 / Math.PI).toFixed(1),
      raise: +dy.toFixed(2),
      skyward: +(cav.skyward ? cav.skyward() : -1).toFixed(3),
      daylight: +(cav.daylight ? cav.daylight() : -1).toFixed(3),
      terrain: +cav.terrainHeight(cp.x, cp.z).toFixed(2),
      camFloor: +cav.camFloor(cp.x, cp.z).toFixed(2),
      camCeil: +cav.camCeil(cp.x, cp.z).toFixed(2),
      framing: g.framing ? +g.framing().toFixed(3) : -1
    };
    o.taskFires = taskFires.slice();
    // stand another 10 s in the zone: does it re-fire?
    taskFires.length = 0;
    settle(600);
    o.refires = taskFires.slice();
    // landmarks, for the wanted framing
    o.landmarks = {};
    for (const k of ['mouth', 'river', 'hand', 'doline', 'wall', 'roost', 'pearls', 'phyto', 'exit']) {
      const L = cav[k]; if (L) o.landmarks[k] = [L.x, L.z];
    }
    // ---- locals within 40 m of the doline stand point ----
    const la = g.npcAudit ? g.npcAudit() : null;
    o.npcAuditKeys = la ? Object.keys(la) : null;
    return o;
  });
  out.errs = errs;
  await page.evaluate(async o => {
    await fetch('/shot?name=b4cav-1.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
