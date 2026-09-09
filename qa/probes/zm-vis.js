async page => {
  await page.reload(); await page.waitForTimeout(6000);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = {};
    const probe = () => {
      const r = {};
      g.scene.traverse(o => {
        if (o.name === 'envTraffic' || o.name === 'envLorikeets' || o.name === 'envGlitter' ||
            o.name === 'environment' || o.name === 'quay' || o.name === 'quayWakeGulls') {
          let vis = o.visible, p = o.parent, chain = [o.name + ':' + o.visible];
          while (p) { chain.push((p.name || '(anon)') + ':' + p.visible); if (!p.visible) vis = false; p = p.parent; }
          r[o.name] = { effective: vis, chain: chain.join(' < ') };
        }
      });
      return r;
    };
    g.biome.switchTo('sydney'); for (let i=0;i<90;i++) g.tick(1/60,false);
    res.inSydney = probe();
    g.biome.switchTo('quay'); for (let i=0;i<90;i++) g.tick(1/60,false);
    res.inQuay = probe();
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=zm.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
