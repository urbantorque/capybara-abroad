async page => {
  // THE FIVE CHAPTERS WHOSE REGULAR IS NOT WITHIN EARSHOT OF THE SPAWN, which
  // is the measurement that made the tier line an ARMED line rather than an
  // arrival line: the Drift's is 26 m from where you land, Son Doong's 31, the
  // Pantanal's 32, Manly's 15, the Antarctic's 16. A line said on arrival
  // would be said to nobody in all five.
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2000);
  const rows = [];
  for (const nm of ['drift', 'cave', 'pantanal', 'manly', 'antarctic', 'monaco']) {
    rows.push(await page.evaluate(async (nm) => {
      const g = window.__capy;
      const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
      const rec0 = () => (g.palAudit().found.filter(x => x.b === nm)[0]);
      const out = { biome: nm, visits: [] };
      for (let v = 0; v < 2; v++) {
        g.biome.switchTo(nm);
        tick(60);
        if (g.biome.current !== nm) { out.err = 'did not switch'; return out; }
        const f = rec0();
        if (!f) { out.err = 'no regular'; return out; }
        const rec = (g.locals || []).filter(l => l.biome === nm &&
          Math.abs(l.x - f.x) < 0.2 && Math.abs(l.z - f.z) < 0.2)[0];
        const said = [];
        if (!rec.anchor.__w) {
          const real = rec.anchor.speak;
          rec.anchor.speak = function (t) { said.push(t); return real.call(this, t); };
          rec.anchor.__w = said;
        } else rec.anchor.__w.length = 0;
        const heard = rec.anchor.__w;
        const sp = g.biome.spawnOf(nm);
        const dSpawn = +Math.hypot(f.x - sp.x, f.z - sp.z).toFixed(1);
        // ARRIVE AT THE SPAWN and stand there for ten seconds, which is where a
        // player is when an arrival line would be said. Then walk over.
        g.capy.body.position.set(sp.x, sp.y + 0.4, sp.z);
        g.capy.body.velocity.set(0, 0, 0);
        tick(60 * 10);
        const atSpawn = heard.slice();
        const armedStill = g.palAudit().line;
        const api = (nm === 'sydney') ? g.env : g[nm];
        const px = f.x + 2.4, pz = f.z;
        const ty = (api && api.terrainHeight) ? api.terrainHeight(px, pz) : sp.y;
        g.capy.body.position.set(px, ty + 0.4, pz);
        g.capy.body.velocity.set(0, 0, 0);
        tick(60 * 75);
        out.visits.push({ v: v + 1, dSpawn, tier: g.palDebug().tier,
          silentAtSpawn: atSpawn.length === 0, heldAtSpawn: armedStill.slice(0, 24),
          said: heard.slice(), fam: +(rec.fam || 0).toFixed(2) });
        // a real away leg, so the next arrival is a real arrival
        g.biome.switchTo(nm === 'drift' ? 'kyoto' : 'drift');
        tick(60 * 20);
      }
      return out;
    }, nm));
  }
  await page.evaluate((o) => fetch('/shot?name=o1-far.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), rows);
}
