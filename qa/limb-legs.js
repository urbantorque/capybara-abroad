async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(4000);
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click(); });
  await page.waitForTimeout(7000);
  const out = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE;
    const cam = g.camera, tgt = new T.Vector3();
    const fov0 = cam.fov;
    function walker(kind) {
      let best = null;
      for (const b of (g.world ? g.world.bodies : [])) {
        const u = b.userData;
        if (!u || !u.npc || !u.npc.group) continue;
        const r = u.npc;
        if (kind && r.kind !== kind) continue;
        if (!best || r.speed > best.speed) best = r;
      }
      return best;
    }
    for (let i = 0; i < 240; i++) g.tick(1 / 60, false);
    const r = walker('tourist') || walker();
    if (!r) return { err: 'nobody' };
    const rows = [];
    const F = x => +x.toFixed(2);
    for (let k = 0; k < 10; k++) {
      for (let i = 0; i < 4; i++) g.tick(1 / 60, false);
      const n = r.nodes, p = r.group.position, a = r.yaw + 1.35;
      cam.fov = 15; cam.updateProjectionMatrix();
      cam.position.set(p.x + Math.sin(a) * 6.0, p.y + 0.62, p.z + Math.cos(a) * 6.0);
      tgt.set(p.x, p.y + 0.42, p.z);
      cam.lookAt(tgt); cam.updateMatrixWorld(true);
      g.post.render();
      const c = g.canvas || g.renderer.domElement;
      await fetch('/shot?name=LEG-' + k, { method: 'POST', body: c.toDataURL('image/png') });
      // sole angle in the person's own frame: hip + knee + ankle
      const soleL = n.legL.rotation.x + n.kneeL.rotation.x + n.footL.rotation.x;
      const soleR = n.legR.rotation.x + n.kneeR.rotation.x + n.footR.rotation.x;
      rows.push({ k, ph: F((r.walkPhase % 6.283185) / 6.283185), spd: F(r.speed),
                  hipL: F(n.legL.rotation.x), kneeL: F(n.kneeL.rotation.x), soleL: F(soleL),
                  hipR: F(n.legR.rotation.x), kneeR: F(n.kneeR.rotation.x), soleR: F(soleR),
                  elbL: F(n.elbowL.rotation.x), elbR: F(n.elbowR.rotation.x),
                  twist: F(n.bob.rotation.y), hips: F(n.hipsN.rotation.y) });
    }
    cam.fov = fov0; cam.updateProjectionMatrix();
    return { biome: g.biome.current, kind: r.kind, rows, err: g.state.lastError || null };
  });
  await page.evaluate(o => fetch('/shot?name=limblegs.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
