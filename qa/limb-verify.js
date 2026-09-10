async page => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 200)));
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click(); });
  await page.waitForFunction(() => !!(window.__capy && window.__capy.state.started), null,
                             { timeout: 30000 });
  const out = { started: true, rows: [] };
  for (const b of ['sahara', 'kowloon', 'venice', 'sydney']) {
    await page.evaluate(n => { window.__capy.hud.cross(n); }, b);
    await page.waitForTimeout(9000);
    const r = await page.evaluate(async () => {
      const g = window.__capy;
      // A person from THIS chapter, framed from four metres by the real lens.
      const list = [];
      for (const bd of (g.world ? g.world.bodies : [])) {
        const u = bd.userData;
        if (u && u.npc && u.npc.group && u.npc.nodes && u.npc.nodes.kneeL)
          list.push({ x: u.npc.group.position.x, y: u.npc.group.position.y,
                      z: u.npc.group.position.z });
      }
      for (const r of (g.locals || []))
        if (r.fig && r.biome === g.biome.current) list.push({ x: r.x, y: r.y, z: r.z });
      let best = list[0], bn = -1;
      for (const p of list) {
        let n = 0;
        for (const q of list) if (Math.hypot(p.x - q.x, p.z - q.z) < 10) n++;
        if (n > bn) { bn = n; best = p; }
      }
      if (best) {
        const cp = g.capy.body.position;
        cp.set(best.x + 3.0, best.y + 0.6, best.z + 3.0);
        g.capy.body.previousPosition.copy(cp);
        g.capy.body.interpolatedPosition.copy(cp);
        g.capy.body.velocity.set(0, 0, 0);
      }
      for (let i = 0; i < 260; i++) g.tick(1 / 60, false);
      g.post.render();
      const c = g.canvas || g.renderer.domElement;
      await fetch('/shot?name=VER-' + g.biome.current, { method: 'POST',
        body: c.toDataURL('image/png') });
      g.renderer.info.autoReset = false;
      g.renderer.info.reset();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const calls = Math.round(g.renderer.info.render.calls / 2);
      g.renderer.info.autoReset = true;
      return { biome: g.biome.current, people: list.length, calls,
               err: g.state.lastError || null };
    });
    out.rows.push(r);
  }
  out.consoleErrors = errs;
  await page.evaluate(o => fetch('/shot?name=limbverify.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
