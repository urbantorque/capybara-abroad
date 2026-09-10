async page => {
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e).slice(0, 160)));
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  let started = false;
  for (let i = 0; i < 12; i++) {
    started = await page.evaluate(() => {
      if (window.__capy && window.__capy.state.started) return true;
      const b = document.querySelector('.capyui-go');
      if (b) b.click();
      return false;
    });
    if (started) break;
    await page.waitForTimeout(3000);
  }
  if (!started) throw new Error('game never started');
  await page.evaluate(() => { window.__capy.hud.cross('kowloon'); });
  await page.waitForTimeout(9000);
  const out = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE;
    const people = [];
    for (const bd of g.world.bodies) {
      const u = bd.userData;
      if (u && (u.npc || u.local)) people.push(bd);
    }
    const freeProp = () => {
      for (const p of g.props) {
        if (!p || p.removed || p.hidden || p.held || p.spilled || p.owner || p.frozen) continue;
        if (p.biome && p.biome !== g.biome.current) continue;
        if (!p.grabbable) continue;
        return p;
      }
      return null;
    };
    const W = new T.Vector3();
    // Fire a prop at (tx,ty,tz) from the mouth, exactly as the main probe does.
    const fire = (prop, tx, ty, tz) => {
      prop.mesh.updateWorldMatrix(true, false);
      prop.mesh.getWorldPosition(W);
      const m = Math.max(0.15, prop.mass || 0.5);
      const dx = tx - W.x, dz = tz - W.z, dy = ty - (W.y + 0.02);
      const L = Math.hypot(dx, dz) || 1;
      const gA = Math.abs(g.world.gravity.y) || 24;
      const S = 9, t = L / S;
      const vy = (dy + 0.5 * gA * t * t) / t;
      g.physics.release(new T.Vector3(dx / L * S * m, (vy - 0.7) * m, dz / L * S * m));
    };
    const setup = B => {
      const tx = B.position.x, ty = B.position.y, tz = B.position.z;
      const a = 1.9, D = 2.2;
      const cx = tx + Math.cos(a) * D, cz = tz + Math.sin(a) * D, cy = ty + 0.05;
      const cb = g.capy.body;
      const park = () => {
        cb.position.set(cx, cy, cz); cb.previousPosition.set(cx, cy, cz);
        cb.interpolatedPosition.set(cx, cy, cz); cb.velocity.set(0, 0, 0);
      };
      park();
      for (let i = 0; i < 45; i++) { g.tick(1 / 60, false); park(); }
      return { tx, ty, tz, park };
    };

    // ---- 1. THE BURST. Eight throws inside about a second and a half ------
    // Whatever lands, the cooldown must cap what pays out. A player standing
    // in the souk with thirty oranges in reach is the case this exists for.
    let burst = null;
    for (const B of people) {
      const S1 = setup(B);
      const a0 = g.physics.hitAudit(true);
      let fired = 0;
      for (let n = 0; n < 8; n++) {
        const p = freeProp();
        if (!p) break;
        if (!g.physics.grab(p)) break;
        for (let i = 0; i < 3; i++) { g.tick(1 / 60, false); S1.park(); }
        fire(p, S1.tx, S1.ty, S1.tz);
        fired++;
        for (let i = 0; i < 12; i++) { g.tick(1 / 60, false); S1.park(); }
      }
      const a1 = g.physics.hitAudit(false);
      const secs = 8 * 15 / 60;
      if (a1.hits + a1.blocked >= 3) {
        burst = { fired, seconds: +secs.toFixed(2), hits: a1.hits, blocked: a1.blocked,
                  ceiling: Math.ceil(secs / a1.cool) };
        break;
      }
      for (let i = 0; i < 200; i++) g.tick(1 / 60, false);
    }

    // ---- 2. A PROP THAT WAS NOT THROWN ------------------------------------
    // Put down with no impulse (physRelease(null) — the set-down path), then
    // shoved along by hand at the same speed a real throw arrives at. It hits
    // the person just as hard; it must earn nothing, because the animal did not
    // throw it. This is the gate that keeps a crate off a barrow, a settling
    // stall and an npc's fumble out of the incident channel.
    let notThrown = null;
    for (const B of people) {
      const S2 = setup(B);
      const p = freeProp();
      if (!p) break;
      if (!g.physics.grab(p)) continue;
      for (let i = 0; i < 3; i++) { g.tick(1 / 60, false); S2.park(); }
      const a0 = g.physics.hitAudit(true);
      g.physics.release(null);                       // a SET-DOWN, not a throw
      const dx = S2.tx - p.body.position.x, dz = S2.tz - p.body.position.z;
      const L = Math.hypot(dx, dz) || 1;
      p.body.wakeUp();
      p.body.velocity.set(dx / L * 9, 1.6, dz / L * 9);   // shoved, by the world
      let touched = 0, vsp = 0;
      const spy = e => {
        const u = e.body && e.body.userData;
        if (u && (u.npc || u.local)) {
          touched++;
          const s = e.contact ? Math.abs(e.contact.getImpactVelocityAlongNormal()) : 0;
          if (s > vsp) vsp = s;
        }
      };
      p.body.addEventListener('collide', spy);
      for (let i = 0; i < 75; i++) { g.tick(1 / 60, false); S2.park(); }
      p.body.removeEventListener('collide', spy);
      const a1 = g.physics.hitAudit(false);
      if (touched) {
        notThrown = { personContacts: touched, contactSpeed: +vsp.toFixed(2),
                      hits: a1.hits, blocked: a1.blocked, thrownT: p.thrownT };
        break;
      }
      for (let i = 0; i < 200; i++) g.tick(1 / 60, false);
    }
    return { biome: g.biome.current, people: people.length, burst, notThrown,
             err: g.state.lastError || null };
  });
  out.errs = errs;
  await page.evaluate(o => fetch('/shot?name=throwrate.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
