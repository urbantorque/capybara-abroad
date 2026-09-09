async page => {
  await page.reload(); await page.waitForTimeout(5200);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(1600);
  const out = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const g = window.__capy;
    g.biome.switchTo('sydney');
    await sleep(600);
    // stand the animal near the promenade so the van is inside the 40 m gate
    const cb = g.capy.body;
    cb.position.set(-40, 1.0, 4); cb.velocity.set(0, 0, 0);
    cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
    const samp = [];
    let lori = 0, loriMax = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 45000) {
      await sleep(200);
      const st = {};
      // count states across the crowd via the scene graph is not exposed; use the debug hook
      samp.push({ t: +((performance.now() - t0) / 1000).toFixed(1),
                  dwell: +g.env.vanDwellLeft().toFixed(1),
                  q: g.env.vanQueueSpot(0).x.toFixed(1) });
    }
    const scene = g.scene;
    let loriMesh = null;
    scene.traverse(o => { if (o.name === 'envLorikeets') loriMesh = o; });
    return { samples: samp.length, lori: !!loriMesh, loriCount: loriMesh ? loriMesh.count : 0,
             lastError: g.state.lastError || null };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=z2van.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
