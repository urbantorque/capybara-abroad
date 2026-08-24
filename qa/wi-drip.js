async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload(); await page.waitForTimeout(6500);
  await page.mouse.click(500, 400);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    g.biome.switchTo('kowloon');
    for (let i=0;i<300;i++) g.tick(1/60,false);
    // find the drop mesh: 32 instances, transparent basic material
    let drop = null, ring = null;
    g.scene.traverse(o => {
      if (o.isInstancedMesh && o.name === 'hkDrip') { drop = o; } else if (o.isInstancedMesh && o.name === 'hkDripRing') { ring = o; } else if (false) {
        if (!drop) drop = o; else if (!ring) ring = o;
      }
    });
    if (!drop) return { found: false };
    let maxLive = 0, everLive = 0, samples = [];
    for (let s=0;s<40;s++) {
      for (let i=0;i<20;i++) g.tick(1/60,false);
      let live = 0;
      const m = drop.instanceMatrix.array;
      for (let i=0;i<32;i++) if (m[i*16+5] > 0.01 && m[i*16+13] > -100) live++;
      if (live > maxLive) maxLive = live;
      if (live > 0) everLive++;
      if (s % 10 === 0) samples.push(live);
    }
    return { found: true, emitters: 32, maxLive, framesWithDrops: everLive + '/40',
             samples, err: g.state.lastError || null };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=wi.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
