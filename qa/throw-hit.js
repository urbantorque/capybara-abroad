async page => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e).slice(0, 160)));
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  let started = false;
  for (let i = 0; i < 6; i++) {
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
  const out = { started, rows: [], errs: [] };
  for (const biome of ['sahara', 'venice', 'kowloon', 'sydney']) {
    await page.evaluate(n => { window.__capy.hud.cross(n); }, biome);
    await page.waitForTimeout(9000);
    const r = await page.evaluate(async b => {
      const g = window.__capy, T = g.THREE;
      const has = !!(g.physics && typeof g.physics.hitAudit === 'function');
      if (has) g.physics.hitAudit(true);
      const people = [];
      for (const bd of g.world.bodies) {
        const u = bd.userData;
        if (!u || !(u.npc || u.local)) continue;
        people.push({ body: bd, rec: u.npc || u.local, kind: u.npc ? 'npc' : 'local' });
      }
      let startles = 0, chain = 0, lastSpeed = 0;
      g.events.on('npc:startled', () => { startles++; });
      g.events.on('capy:chain', () => { chain++; });
      g.events.on('prop:impact', p => { if (p && p.speed > lastSpeed) lastSpeed = p.speed; });

      // The states npc.js puts a walker into when it is frightened. A LOCAL has
      // no state machine at all — a fixed figure is only ever a flinch spring —
      // so in seventeen of the nineteen chapters `flV` is the whole of the
      // reaction there is to read.
      const REACT = { startled: 1, flee: 1, fluster: 1, shoo: 1, cornered: 1, plunge: 1 };
      const W = new T.Vector3();
      const all = [];
      const BUDGET = 20;
      let shots = 0, contacts = 0;

      outer:
      for (let k = 0; k < people.length && shots < BUDGET; k++) {
        const P = people[k];
        // Round the clock: in a souk or a lane most bearings are blocked by a
        // stall or a wall, so one line of fire measures the architecture rather
        // than the rule.
        for (let s = 0; s < 8 && shots < BUDGET; s++) {
          // RE-READ EVERY SHOT. Sydney's and Pasto's people WALK, and forty-five
          // frames of settling is three metres of pavement — aiming at where
          // they were when the loop started is why the first cut of this probe
          // got three contacts out of twenty shots in the one chapter whose
          // cast can only be measured by its state machine.
          const tx = P.body.position.x, ty = P.body.position.y, tz = P.body.position.z;
          let prop = null;
          for (const p of g.props) {
            if (!p || p.removed || p.hidden || p.held || p.spilled || p.owner || p.frozen) continue;
            if (p.biome && p.biome !== g.biome.current) continue;
            if (!p.grabbable) continue;
            prop = p; break;
          }
          if (!prop) break outer;
          const D = 2.4, a = s * Math.PI / 4;
          const cx = tx + Math.cos(a) * D, cz = tz + Math.sin(a) * D, cy = ty + 0.05;
          const cb = g.capy.body;
          const park = () => {
            cb.position.set(cx, cy, cz); cb.previousPosition.set(cx, cy, cz);
            cb.interpolatedPosition.set(cx, cy, cz); cb.velocity.set(0, 0, 0);
          };
          park();
          for (let i = 0; i < 45; i++) { g.tick(1 / 60, false); park(); }
          if (!g.physics.grab(prop)) continue;
          for (let i = 0; i < 8; i++) { g.tick(1 / 60, false); park(); }
          // physRelease launches from the MESH world position (the prop is
          // parented to the head while held), so the solve has to start there.
          prop.mesh.updateWorldMatrix(true, false);
          prop.mesh.getWorldPosition(W);
          const m = Math.max(0.15, prop.mass || 0.5);
          const dx = tx - W.x, dz = tz - W.z, dy = ty - (W.y + 0.02);
          const L = Math.hypot(dx, dz) || 1;
          const gA = Math.abs(g.world.gravity.y) || 24;
          // A short flat shot at 9 m/s — inside the horizontal component a real
          // full charge produces (capyTryRelease tops out at 14.3 with a run) —
          // with the rise solved so it arrives at the chest and not the ankles.
          // physRelease adds 0.7 m/s of lift of its own; subtract it.
          const S = 9, t = L / S;
          const vy = (dy + 0.5 * gA * t * t) / t;

          // ---- GROUND TRUTH, and it is not this pass's own counter ----------
          // A second listener on the same body, classifying the other side of
          // every contact by npc.js's `userData`. Nothing about it depends on
          // the rule under test, so it reads the same on a build that has never
          // heard of it — which is the whole point of a differential.
          let victim = null, vSpeed = 0, vKind = '';
          const spy = e => {
            const u = e.body && e.body.userData;
            const rec = u && (u.npc || u.local);
            if (!rec || victim) return;
            victim = rec;
            vKind = u.npc ? 'npc' : 'local';
            vSpeed = e.contact ? Math.abs(e.contact.getImpactVelocityAlongNormal()) : 0;
          };
          prop.body.addEventListener('collide', spy);

          const s0 = startles, c0 = chain;
          const a0 = has ? g.physics.hitAudit(false) : null;
          lastSpeed = 0;
          // WAS THE VICTIM ALREADY FRIGHTENED, snapshotted BEFORE the throw and
          // not on the first frame after the contact. The rule fires from inside
          // the cannon collide callback, so by the time the spy — or anything
          // else — can look, the state it is asking about has already changed:
          // the first cut of this probe read "already startled" for every single
          // hit and reported 0/13 in a run that had plainly startled people.
          const preState = new Map();
          for (let q = 0; q < people.length; q++) {
            preState.set(people[q].rec, REACT[people[q].rec.state] ? 1 : 0);
          }
          g.physics.release(new T.Vector3(dx / L * S * m, (vy - 0.7) * m, dz / L * S * m));
          shots++;
          let flPeak = 0, reacted = 0;
          for (let i = 0; i < 75; i++) {
            g.tick(1 / 60, false); park();
            if (victim) {
              const fv = Math.abs(victim.flV || 0);
              if (fv > flPeak) flPeak = fv;
              if (!preState.get(victim) && REACT[victim.state]) reacted = 1;
            }
          }
          prop.body.removeEventListener('collide', spy);
          const a1 = has ? g.physics.hitAudit(false) : null;
          const dh = a1 ? a1.hits - a0.hits : 0;
          if (victim) contacts++;
          all.push({ bearing: s, prop: prop.type,
                     hit: victim ? 1 : 0, vKind, vSpeed: +vSpeed.toFixed(2),
                     over: vSpeed >= 3.6 ? 1 : 0,
                     flPeak: +flPeak.toFixed(2), reacted,
                     ruleHits: dh, ruleBlocked: a1 ? a1.blocked - a0.blocked : 0,
                     startles: startles - s0, chain: chain - c0,
                     impact: +lastSpeed.toFixed(2) });
          for (let i = 0; i < 130; i++) g.tick(1 / 60, false);
        }
      }
      // The aggregate the differential is read off: only the shots that
      // actually touched a person above the rule's own speed gate.
      let nOver = 0, flOver = 0, reactOver = 0, stOver = 0, flOverMax = 0;
      let nMiss = 0, flMiss = 0;
      for (const r2 of all) {
        if (r2.hit && r2.over) {
          nOver++; flOver += r2.flPeak; reactOver += r2.reacted; stOver += r2.startles;
          if (r2.flPeak > flOverMax) flOverMax = r2.flPeak;
        } else { nMiss++; flMiss += r2.flPeak; }
      }
      // Nothing a task needs may have gone missing.
      let owned = 0, ownedBad = 0;
      for (const p of g.props) {
        if (!p || !p.owner) continue;
        if (p.biome && p.biome !== g.biome.current) continue;
        owned++;
        if (p.removed || p.body.position.y < -50 ||
            Math.hypot(p.body.position.x, p.body.position.z) > 900) ownedBad++;
      }
      return { biome: b, has, people: people.length, shots, contacts, all,
               nOver, flOver: +(nOver ? flOver / nOver : 0).toFixed(2), flOverMax,
               reactOver, stOver: +(nOver ? stOver / nOver : 0).toFixed(2),
               nMiss, flMiss: +(nMiss ? flMiss / nMiss : 0).toFixed(2),
               startles, chain, owned, ownedBad,
               audit: has ? g.physics.hitAudit(false) : null,
               err: g.state.lastError || null };
    }, biome);
    out.rows.push(r);
    const png = await page.screenshot({ type: 'png' });
    await page.evaluate(async o => { await fetch('/shot?name=' + o.n, { method: 'POST', body: o.b }); },
      { n: 'throwhit-' + biome, b: png.toString('base64') });
  }
  out.errs = errs.slice(0, 12);
  await page.evaluate(o => fetch('/shot?name=throwhit.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
