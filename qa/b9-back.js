async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);
  const out = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const g = window.__capy, THREE = g.THREE;
    if (g.biome.current !== 'hanoi') { g.biome.switchTo('hanoi'); await sleep(1600); }
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
    const r = { live: g.biome.current, inst: [] };
    const m4 = new THREE.Matrix4(), wp = new THREE.Vector3();
    g.scene.traverse((o) => {
      if (!o.isInstancedMesh) return;
      let p = o, vis = true;
      while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
      if (!vis) return;
      let south = 0, big = 0;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m4); wp.setFromMatrixPosition(m4);
        const sc = Math.max(Math.abs(m4.elements[0]), Math.abs(m4.elements[5]), Math.abs(m4.elements[10]));
        if (sc > 4) big++;
        if (wp.z < -20 && sc > 4) south++;
      }
      if (big) r.inst.push({ n: o.count, big: big, south: south,
                             rad: +(o.geometry.boundingSphere ? o.geometry.boundingSphere.radius : -1).toFixed(2) });
    });
    // and the built density in the quadrant the player walks into
    const api = g.hanoi;
    r.bounds = api.bounds ? api.bounds() : null;
    return r;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b9-back.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
