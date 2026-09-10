async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(4500);
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click(); });
  await page.waitForTimeout(8000);
  const started = await page.evaluate(() => !!(window.__capy && window.__capy.state.started));
  const out = { started, rows: [] };
  for (const b of ['sahara', 'kowloon', 'venice', 'sydney', 'pasto']) {
    await page.evaluate(n => { window.__capy.hud.cross(n); }, b);
    await page.waitForTimeout(9000);
    const r = await page.evaluate(async () => {
      const g = window.__capy;
      const list = [];
      for (const bd of (g.world ? g.world.bodies : [])) {
        const u = bd.userData;
        if (u && u.npc && u.npc.group)
          list.push({ x: u.npc.group.position.x, y: u.npc.group.position.y,
                      z: u.npc.group.position.z });
      }
      for (const r of (g.locals || []))
        if (r.fig && r.biome === g.biome.current) list.push({ x: r.x, y: r.y, z: r.z });
      if (!list.length) return { biome: g.biome.current, people: 0 };
      // the person with the most company: that is where a crowd shot is
      let best = list[0], bn = -1;
      for (const p of list) {
        let n = 0;
        for (const q of list) if (Math.hypot(p.x - q.x, p.z - q.z) < 9) n++;
        if (n > bn) { bn = n; best = p; }
      }
      const cp = g.capy.body.position;
      cp.set(best.x + 4.5, best.y + 0.6, best.z + 4.5);
      cp.y = best.y + 0.6;
      g.capy.body.previousPosition.copy(cp);
      g.capy.body.interpolatedPosition.copy(cp);
      g.capy.body.velocity.set(0, 0, 0);
      for (let i = 0; i < 200; i++) g.tick(1 / 60, false);
      g.post.render();
      const c = g.canvas || g.renderer.domElement;
      await fetch('/shot?name=PLAY-' + g.biome.current, { method: 'POST',
        body: c.toDataURL('image/png') });
      return { biome: g.biome.current, people: list.length, cluster: bn,
               err: g.state.lastError || null };
    });
    out.rows.push(r);
  }
  await page.evaluate(o => fetch('/shot?name=limbplayed.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
