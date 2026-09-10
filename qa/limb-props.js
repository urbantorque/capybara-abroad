async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(4500);
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click(); });
  await page.waitForTimeout(9000);
  const out = { rows: [] };
  for (const b of ['sydney', 'quay', 'pasto']) {
    await page.evaluate(n => { window.__capy.hud.cross(n); }, b);
    await page.waitForTimeout(9000);
    const r = await page.evaluate(async () => {
      const g = window.__capy, T = g.THREE;
      for (let i = 0; i < 600; i++) g.tick(1 / 60, false);
      const sh = new T.Vector3(), hd = new T.Vector3();
      const rows = [];
      let seatN = 0, holdN = 0, worst = 0, worstWho = '';
      for (const bd of (g.world ? g.world.bodies : [])) {
        const u = bd.userData;
        if (!u || !u.npc || !u.npc.nodes || !u.npc.nodes.toolN) continue;
        const r = u.npc, n = r.nodes;
        const holding = r.hasCamera || r.coneT >= 0 || n.toolN.scale.x > 0.5 ||
                        (n.broomN && n.broomN.scale.x > 0.5);
        if (r.seatPose > 0.5) seatN++;
        if (!holding) continue;
        holdN++;
        sh.setFromMatrixPosition(n.armR.matrixWorld);
        hd.setFromMatrixPosition(n.handR.matrixWorld);
        // With a straight elbow the hand is 0.56 x root scale below the
        // shoulder, which is exactly where it was before the joint existed.
        const d = sh.distanceTo(hd) / (r.bH || 1);
        const off = Math.abs(d - 0.56);
        if (off > worst) { worst = off; worstWho = r.kind; }
        rows.push({ kind: r.kind, elb: +n.elbowR.rotation.x.toFixed(3),
                    reach: +d.toFixed(3) });
      }
      return { biome: g.biome.current, seated: seatN, holding: holdN,
               worstOff: +worst.toFixed(3), worstWho,
               sample: rows.slice(0, 6), err: g.state.lastError || null };
    });
    out.rows.push(r);
  }
  await page.evaluate(o => fetch('/shot?name=limbprops.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
