async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(4500);
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click(); });
  await page.waitForTimeout(9000);
  const out = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE;
    const cam = g.camera, fov0 = cam.fov, tgt = new T.Vector3();
    for (let i = 0; i < 900; i++) g.tick(1 / 60, false);
    const want = [];
    for (const bd of (g.world ? g.world.bodies : [])) {
      const u = bd.userData;
      if (!u || !u.npc || !u.npc.nodes || !u.npc.nodes.toolN) continue;
      const r = u.npc;
      if (r.seatPose > 0.7) want.push(['sit', r]);
      else if (r.nodes.toolN.scale.x > 0.5) want.push(['tool', r]);
      else if (r.hasCamera) want.push(['cam', r]);
    }
    const rows = [];
    const tags = {};
    for (const [tag, r] of want) {
      tags[tag] = (tags[tag] || 0) + 1;
      if (tags[tag] > 1) continue;
      const p = r.group.position, a = r.yaw + 1.1;
      cam.fov = 20; cam.updateProjectionMatrix();
      cam.position.set(p.x + Math.sin(a) * 5.0, p.y + 2.0, p.z + Math.cos(a) * 5.0);
      tgt.set(p.x, p.y + 0.85, p.z);
      cam.lookAt(tgt); cam.updateMatrixWorld(true);
      g.post.render();
      const c = g.canvas || g.renderer.domElement;
      await fetch('/shot?name=SIT-' + tag, { method: 'POST', body: c.toDataURL('image/png') });
      rows.push({ tag, kind: r.kind, seat: +r.seatPose.toFixed(2),
                  knee: +r.nodes.kneeL.rotation.x.toFixed(2),
                  hip: +r.nodes.legL.rotation.x.toFixed(2) });
    }
    cam.fov = fov0; cam.updateProjectionMatrix();
    return { biome: g.biome.current, rows, err: g.state.lastError || null };
  });
  await page.evaluate(o => fetch('/shot?name=limbsit.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
