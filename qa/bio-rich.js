async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);

  const out = [];
  for (const b of ['sydney', 'pasto']) {
    await page.evaluate((n) => {
      const g = window.__capy;
      try { g.hud.cross(n); } catch (e) { g.biome.switchTo(n); }
    }, b);
    await page.waitForTimeout(4500);

    const row = await page.evaluate((n) => new Promise((res) => {
      const g = window.__capy;
      // The rich cast is NOT in the scene by design — npc.js's header says so:
      // a pure Object3D skeleton whose node matrices are copied into a handful
      // of InstancedMeshes every frame. So a scene-attachment test excludes all
      // of them, and only Sydney and Pasto put anybody in this roster: Sydney's
      // 38 at boot, Pasto's on top.
      const list = n === 'sydney' ? g.npcs.slice(0, 38) : g.npcs.slice(38);
      const snap = (o) => {
        const a = [];
        o.traverse(c => a.push(c.position.x, c.position.y, c.position.z,
                               c.rotation.x, c.rotation.y, c.rotation.z));
        return { a: a, x: o.position.x, z: o.position.z };
      };
      const first = list.map(r => snap(r.group));
      const mr = new Array(list.length).fill(0), mp = new Array(list.length).fill(0);
      const t0 = performance.now();
      (function step() {
        for (let i = 0; i < list.length; i++) {
          const s = snap(list[i].group), f = first[i];
          const d = Math.hypot(s.x - f.x, s.z - f.z);
          if (d > mr[i]) mr[i] = d;
          let m = 0;
          const L = Math.min(s.a.length, f.a.length);
          for (let k = 0; k < L; k++) { const q = Math.abs(s.a[k] - f.a[k]); if (q > m) m = q; }
          if (m > mp[i]) mp[i] = m;
        }
        if (performance.now() - t0 < 7000) requestAnimationFrame(step);
        else res({
          biome: g.biome.current, n: list.length,
          rows: list.map((r, i) => ({ kind: r.kind, state: r.state,
                                      root: +mr[i].toFixed(2), part: +mp[i].toFixed(3) })),
        });
      })();
    }), b);
    out.push(row);
  }
  await page.evaluate(async (p) => {
    await fetch('/shot?name=BIO-RICH', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(p)))) });
  }, out);
}
