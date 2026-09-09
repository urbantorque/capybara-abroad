async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);

  const CH = ['sydney', 'manly', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara',
              'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'pantanal', 'cave',
              'antarctic', 'monaco', 'hanoi', 'pasto'];
  const out = [];

  for (const b of CH) {
    await page.evaluate((n) => {
      const g = window.__capy;
      try { g.hud.cross(n); } catch (e) { g.biome.switchTo(n); }
    }, b);
    await page.waitForTimeout(4500);

    const row = await page.evaluate(() => {
      return new Promise((resolve) => {
        const g = window.__capy;
        const live = g.biome && g.biome.current;

        // Every person in the world, however the chapter spells it.
        const cast = [];
        const seen = new Set();
        // LIVE ONLY. `game.locals` ACCUMULATES across chapters and `game.npcs`
        // keeps Sydney's 38 for ever, so an unfiltered read reports every
        // chapter you have already visited as a field of statues — which is
        // exactly what the first run of this probe did (208 "cast" in Pasto,
        // 190 of them "dead"). A detached chapter's root is hidden and its
        // children all keep visible === true, so the test has to walk the
        // parents, and the object has to still reach the scene.
        function isLive(o) {
          let p = o, root = null;
          for (; p; p = p.parent) { if (!p.visible) return false; root = p; }
          return root === g.scene;
        }
        function take(arr, tag) {
          if (!arr || !arr.length) return;
          for (const r of arr) {
            const grp = r && (r.group || r.g || r.mesh || r.obj);
            if (!grp || !grp.isObject3D || seen.has(grp.uuid)) continue;
            if (!isLive(grp)) continue;
            seen.add(grp.uuid);
            cast.push({ tag: tag, grp: grp, rec: r });
          }
        }
        // The audit surface is flattened onto `game` itself. `game.npcs` is the
        // RICH roster — full state machines, gait, pose targets — and only
        // Sydney (38) and Pasto (+18) put anybody in it. `game.locals` is the
        // simple cast, and it is who stands in the other seventeen chapters.
        take(g.npcs, 'rich');
        take(g.locals, 'local');

        // Snapshot: world position, world quaternion, and every descendant's
        // LOCAL transform, so an arm swinging inside a standing figure counts.
        function snap(o) {
          const a = [];
          o.updateWorldMatrix(true, true);
          o.traverse(function (c) {
            a.push(c.position.x, c.position.y, c.position.z,
                   c.rotation.x, c.rotation.y, c.rotation.z,
                   c.scale.x, c.scale.y, c.scale.z);
          });
          const w = new g.THREE.Vector3();
          o.getWorldPosition(w);
          return { parts: a, wx: w.x, wy: w.y, wz: w.z };
        }

        const first = cast.map(c => snap(c.grp));
        const maxRoot = new Array(cast.length).fill(0);   // world xz travel
        const maxPart = new Array(cast.length).fill(0);   // biggest local-part delta
        const maxY = new Array(cast.length).fill(0);

        let ticks = 0;
        const t0 = performance.now();
        function sample() {
          for (let i = 0; i < cast.length; i++) {
            const s = snap(cast[i].grp), f = first[i];
            const dxz = Math.hypot(s.wx - f.wx, s.wz - f.wz);
            if (dxz > maxRoot[i]) maxRoot[i] = dxz;
            const dy = Math.abs(s.wy - f.wy);
            if (dy > maxY[i]) maxY[i] = dy;
            const n = Math.min(s.parts.length, f.parts.length);
            let m = 0;
            for (let k = 0; k < n; k++) {
              const d = Math.abs(s.parts[k] - f.parts[k]);
              if (d > m) m = d;
            }
            if (m > maxPart[i]) maxPart[i] = m;
          }
          ticks++;
          if (performance.now() - t0 < 7000) requestAnimationFrame(sample);
          else finish();
        }
        function finish() {
          const cp = g.capy && g.capy.position;
          const rows = cast.map((c, i) => {
            const w = new g.THREE.Vector3();
            c.grp.getWorldPosition(w);
            let parts = 0;
            c.grp.traverse(function () { parts++; });
            return {
              tag: c.tag, parts: parts,
              near: cp ? +Math.hypot(w.x - cp.x, w.z - cp.z).toFixed(1) : -1,
              root: +maxRoot[i].toFixed(3),
              y: +maxY[i].toFixed(3),
              part: +maxPart[i].toFixed(4),
            };
          });
          resolve({ biome: live, ticks: ticks, n: cast.length, rows: rows });
        }
        requestAnimationFrame(sample);
      });
    });
    out.push(row);
  }

  await page.evaluate(async (payload) => {
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    await fetch('/shot?name=BIO-LIFE', { method: 'POST', body: b64 });
  }, out);
}
