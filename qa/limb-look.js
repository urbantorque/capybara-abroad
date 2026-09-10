async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(4000);
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click(); });
  await page.waitForTimeout(6000);
  const started = await page.evaluate(() => !!(window.__capy && window.__capy.state.started));
  const out = { started, rows: [] };
  const plan = [['sydney', 6], ['sahara', 6], ['kowloon', 6], ['venice', 6], ['pasto', 6]];
  for (const [biome, shots] of plan) {
    await page.evaluate(n => { window.__capy.hud.cross(n); }, biome);
    await page.waitForTimeout(9000);
    const r = await page.evaluate(async (o) => {
      const g = window.__capy, T = g.THREE;
      const biome = o.biome, shots = o.shots;
      const cam = g.camera;
      const v = new T.Vector3(), tgt = new T.Vector3();
      // Every person this module draws, roster or local, with a world point.
      function people() {
        const list = [];
        for (const b of (g.world ? g.world.bodies : [])) {
          const u = b.userData;
          if (!u || !u.npc || !u.npc.group) continue;
          const r = u.npc;
          list.push({ tag: 'roster', x: r.group.position.x, y: r.group.position.y,
                      z: r.group.position.z, yaw: r.yaw || 0, spd: r.speed || 0 });
        }
        for (const r of (g.locals || [])) {
          if (!r.fig || !r.fig.group || r.biome !== g.biome.current) continue;
          list.push({ tag: 'local', x: r.x, y: r.y, z: r.z, yaw: r.yaw || 0,
                      spd: (r.mv || 0) * 1.2 });
        }
        return list;
      }
      const seen = [];
      const urls = [];
      for (let k = 0; k < shots; k++) {
        for (let i = 0; i < 26; i++) g.tick(1 / 60, false);
        const ps = people();
        if (!ps.length) break;
        ps.sort((a, b) => b.spd - a.spd);
        const p = ps[0];
        seen.push({ tag: p.tag, spd: +p.spd.toFixed(2) });
        // 3.4 m out, three-quarter on from the front-left, eye at chest height:
        // the angle a walk is legible from. A side-on shot hides the twist and
        // a head-on shot hides the knee.
        const a = p.yaw + 2.25;
        cam.position.set(p.x + Math.sin(a) * 3.4, p.y + 1.05, p.z + Math.cos(a) * 3.4);
        tgt.set(p.x, p.y + 0.80, p.z);
        cam.lookAt(tgt);
        cam.updateMatrixWorld(true);
        g.post.render();
        const c = g.canvas || g.renderer.domElement;
        urls.push(c.toDataURL('image/png'));
      }
      for (let i = 0; i < urls.length; i++)
        await fetch('/shot?name=LIMB-' + biome + '-' + i, { method: 'POST', body: urls[i] });
      return { biome: g.biome.current, shots: urls.length, seen,
               err: g.state.lastError || null };
    }, { biome, shots });
    out.rows.push(r);
  }
  await page.evaluate(o => fetch('/shot?name=limblook.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
