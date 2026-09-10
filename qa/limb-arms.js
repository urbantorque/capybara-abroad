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
    function walker() {
      let best = null;
      for (const b of (g.world ? g.world.bodies : [])) {
        const u = b.userData;
        if (!u || !u.npc || !u.npc.group) continue;
        const r = u.npc;
        if (r.kind !== 'tourist' || r.hasCamera || r.speed < 0.6) continue;
        if (!best || r.speed > best.speed) best = r;
      }
      return best;
    }
    for (let i = 0; i < 240; i++) g.tick(1 / 60, false);
    const r = walker();
    if (!r) return { err: 'nobody' };
    const rows = [];
    const angles = [1.35, 0.6, 2.6];   // side, three-quarter front, three-quarter back
    for (let k = 0; k < 6; k++) {
      for (let i = 0; i < 4; i++) g.tick(1 / 60, false);
      const p = r.group.position, a = r.yaw + angles[k % 3];
      cam.fov = 12; cam.updateProjectionMatrix();
      cam.position.set(p.x + Math.sin(a) * 6.0, p.y + 1.60, p.z + Math.cos(a) * 6.0);
      tgt.set(p.x, p.y + 1.15, p.z);
      cam.lookAt(tgt); cam.updateMatrixWorld(true);
      g.post.render();
      const c = g.canvas || g.renderer.domElement;
      await fetch('/shot?name=ARM-' + k, { method: 'POST', body: c.toDataURL('image/png') });
      rows.push({ k, ang: angles[k % 3],
                  ph: +((r.walkPhase % 6.283185) / 6.283185).toFixed(2),
                  elbL: +r.nodes.elbowL.rotation.x.toFixed(2),
                  elbR: +r.nodes.elbowR.rotation.x.toFixed(2) });
    }
    cam.fov = fov0; cam.updateProjectionMatrix();
    return { biome: g.biome.current, rows, err: g.state.lastError || null };
  });
  await page.evaluate(o => fetch('/shot?name=limbarms.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
