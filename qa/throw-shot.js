async page => {
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
  const shot = async name => {
    const b = await page.screenshot({ type: 'png' });
    await page.evaluate(async o => { await fetch('/shot?name=' + o.n, { method: 'POST', body: o.b }); },
      { n: name, b: b.toString('base64') });
  };
  for (const biome of ['venice', 'kowloon', 'sydney']) {
    await page.evaluate(n => { window.__capy.hud.cross(n); }, biome);
    await page.waitForTimeout(9000);
    // Set up in stepped time, then hand the frame back to the real loop so it
    // renders: g.tick(dt, false) does not draw.
    const ok = await page.evaluate(async () => {
      const g = window.__capy, T = g.THREE;
      const people = [];
      for (const bd of g.world.bodies) {
        const u = bd.userData;
        if (u && (u.npc || u.local)) people.push(bd);
      }
      const yaw = g.capy.animAudit().yaw;
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      window.__throwPin = null;
      for (let k = 0; k < people.length; k++) {
        const B = people[k];
        const tx = B.position.x, ty = B.position.y, tz = B.position.z;
        let prop = null;
        for (const p of g.props) {
          if (!p || p.removed || p.hidden || p.held || p.spilled || p.owner || p.frozen) continue;
          if (p.biome && p.biome !== g.biome.current) continue;
          if (!p.grabbable) continue;
          prop = p; break;
        }
        if (!prop) return false;
        // Stand BEHIND the victim along the animal's own facing, so the camera
        // — which sits behind the animal on that same bearing — is looking at
        // the person about to be hit. The yaw cannot be written from outside.
        const D = 3.0;
        const cx = tx - fx * D, cz = tz - fz * D, cy = ty + 0.05;
        const cb = g.capy.body;
        const park = () => {
          cb.position.set(cx, cy, cz); cb.previousPosition.set(cx, cy, cz);
          cb.interpolatedPosition.set(cx, cy, cz); cb.velocity.set(0, 0, 0);
        };
        park();
        for (let i = 0; i < 45; i++) { g.tick(1 / 60, false); park(); }
        if (!g.physics.grab(prop)) continue;
        for (let i = 0; i < 8; i++) { g.tick(1 / 60, false); park(); }
        const W = new T.Vector3();
        prop.mesh.updateWorldMatrix(true, false);
        prop.mesh.getWorldPosition(W);
        const m = Math.max(0.15, prop.mass || 0.5);
        const dx = tx - W.x, dz = tz - W.z, dy = ty - (W.y + 0.02);
        const L = Math.hypot(dx, dz) || 1;
        const gA = Math.abs(g.world.gravity.y) || 24;
        const S = 9, t = L / S;
        const vy = (dy + 0.5 * gA * t * t) / t;
        let victim = null;
        const spy = e => {
          const u = e.body && e.body.userData;
          if ((u && (u.npc || u.local)) && !victim) victim = u.npc || u.local;
        };
        prop.body.addEventListener('collide', spy);
        const h0 = g.physics.hitAudit(false).hits;
        g.physics.release(new T.Vector3(dx / L * S * m, (vy - 0.7) * m, dz / L * S * m));
        for (let i = 0; i < 30; i++) { g.tick(1 / 60, false); park(); }
        prop.body.removeEventListener('collide', spy);
        const h1 = g.physics.hitAudit(false).hits;
        if (h1 > h0) {
          // Hold the animal where it is while the real loop draws the reaction.
          window.__throwPin = setInterval(park, 8);
          return { hit: true, victim: !!victim, flV: +((victim && victim.flV) || 0).toFixed(2),
                   state: (victim && victim.state) || '' };
        }
      }
      return false;
    });
    if (ok && ok.hit) {
      await page.waitForTimeout(120);
      await shot('throwhit-' + biome + '-a');
      await page.waitForTimeout(600);
      await shot('throwhit-' + biome + '-b');
    } else {
      await shot('throwhit-' + biome + '-miss');
    }
    await page.evaluate(() => { if (window.__throwPin) { clearInterval(window.__throwPin); window.__throwPin = null; } });
  }
}
