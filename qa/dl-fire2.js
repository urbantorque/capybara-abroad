async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2600);
  const JOBS = [
    ['pasto',    'rim'],
    ['kyoto',    'bamboo'],
    ['kyoto',    'heron'],
    ['cali',     'mirador'],
    ['rio',      'steps'],
    ['rio',      'arches'],
    ['iceland',  'fox'],
    ['sahara',   'souk'],
    ['drift',    'orchard'],
    ['manly',    'shelly'],
    ['pantanal', 'sandbar'],
    ['cave',     'deep'],
    ['antarctic','whalers'],
    ['antarctic','colony']
  ];
  const out = {};
  for (const [bio, job] of JOBS) {
    out[bio + '/' + job] = await page.evaluate((arg) => {
      const g = window.__capy;
      const nm = arg.bio;
      g.biome.switchTo(nm);
      for (let i = 0; i < 40; i++) g.tick(1/60, false);
      const a = nm === 'sydney' ? g.env : g[nm];
      const b = g.capy.body;
      function gy(x, z) { try { const h = a.terrainHeight(x, z); return (h === h) ? h : 0; } catch (e) { return 0; } }
      function put(x, z, dy) {
        b.position.set(x, gy(x, z) + (dy === undefined ? 0.45 : dy), z);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        b.velocity.set(0,0,0); b.wakeUp();
        g.capy.position.set(b.position.x, b.position.y, b.position.z);
      }
      function park(x, z, frames, dy) {
        put(x, z, dy);
        for (let i = 0; i < frames; i++) {
          g.tick(1/60, false);
          const p = g.capy.position;
          if (Math.hypot(p.x - x, p.z - z) > 0.9) put(x, z, dy);
        }
      }
      const R = { id: null, got: false, note: null };
      if (arg.job === 'rim') {
        R.id = 'the-rim-walk';
        const cc = a.craterCentre;
        const RAD = 12.5;
        // one full turn in small steps, resting three frames at each
        for (let k = 0; k <= 200 && !g.noticed(R.id); k++) {
          const th = k * 0.035;
          put(cc.x + Math.cos(th) * RAD, cc.z + Math.sin(th) * RAD, 0.35);
          for (let i = 0; i < 5; i++) g.tick(1/60, false);
        }
        R.note = 'centre ' + cc.x.toFixed(0) + ',' + cc.z.toFixed(0);
      } else if (arg.job === 'bamboo') {
        R.id = 'still-bamboo'; park(-84, -44, 1300);
      } else if (arg.job === 'heron') {
        R.id = 'the-heron';
        const h = a.heron();
        put(h.x + 4, h.z + 2, 0.45);
        for (let i = 0; i < 900 && !g.noticed(R.id); i++) {
          g.tick(1/60, false);
          const p = g.capy.position;
          if (Math.hypot(p.x - (h.x + 4), p.z - (h.z + 2)) > 0.9) put(h.x + 4, h.z + 2, 0.45);
        }
        R.note = 'standing=' + a.heronStanding();
      } else if (arg.job === 'mirador') {
        R.id = 'walked-the-hill'; const m = a.mirador; park(m.x, m.z, 400);
      } else if (arg.job === 'steps') {
        R.id = 'on-the-steps'; const s = a.selaron; park(s.x, s.z, 1200);
      } else if (arg.job === 'arches') {
        R.id = 'under-the-arches'; const l = a.lapa; park(l.x, l.z, 500);
        R.note = 'y=' + g.capy.position.y.toFixed(1);
      } else if (arg.job === 'fox') {
        R.id = 'the-fox';
        const f = a.fox(); put(f.x + 6, f.z + 4, 0.45);
        for (let i = 0; i < 1500 && !g.noticed(R.id); i++) {
          if (i % 120 === 0) { g.input.honk = true; g.input.honkPressed = true; }
          g.tick(1/60, false);
        }
        R.note = 'interest=' + a.foxInterest().toFixed(2);
      } else if (arg.job === 'souk') {
        R.id = 'lost-in-the-souk'; park(0, -38, 5200);
      } else if (arg.job === 'orchard') {
        R.id = 'the-orchard'; const o = a.orchard; park(o.x, o.z, 1500);
      } else if (arg.job === 'shelly') {
        R.id = 'round-the-corner'; const s = a.shelly; park(s.x, s.z, 600);
      } else if (arg.job === 'sandbar') {
        R.id = 'on-the-sandbar'; const s = a.sandbar; park(s.x, s.z, 800);
      } else if (arg.job === 'deep') {
        R.id = 'nothing-behind'; park(0, -90, 300);
        R.note = 'daylight=' + a.daylight().toFixed(3) + ' y=' + g.capy.position.y.toFixed(1);
      } else if (arg.job === 'whalers') {
        R.id = 'the-whalers'; const w = a.whalers; park(w.x, w.z, 800);
      } else if (arg.job === 'colony') {
        R.id = 'ignored'; const c2 = a.colony; park(c2.x, c2.z, 1600);
      }
      R.got = g.noticed(R.id);
      R.err = g.state.lastError || null;
      return R;
    }, { bio, job });
  }
  await page.evaluate((o) => fetch('/shot?name=dl-fire2.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
