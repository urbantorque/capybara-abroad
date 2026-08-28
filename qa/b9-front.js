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
    const r = { live: g.biome.current, ring: [] };
    g.capy.group.visible = false;                       // trap 11
    const rc = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    // 24 stations round the lake ring, each sampled at 10, 16 and 24 m outward
    // from the ring's centre. Anything standing there is a roof.
    const C = { x: 0, z: -58 };
    for (let k = 0; k < 24; k++) {
      const a = k / 24 * Math.PI * 2;
      const row = { deg: Math.round(a * 57.3), at: [], h: [] };
      for (const R of [70, 78, 90]) {
        const x = C.x + Math.cos(a) * R * 0.86, z = C.z + Math.sin(a) * R * 0.62;
        rc.set(new THREE.Vector3(x, 60, z), down);
        rc.far = 90;
        const hit = rc.intersectObject(g.scene, true).filter(h => h.object.visible)[0];
        row.at.push([Math.round(x), Math.round(z)]);
        row.h.push(hit ? +hit.point.y.toFixed(1) : -99);
      }
      r.ring.push(row);
    }
    g.capy.group.visible = true;
    return r;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b9-front.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
