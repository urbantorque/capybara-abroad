async page => {
  const out = { pairs: {} };
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    window.__qaGo = (name) => {
      const g = window.__capy;
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name);
      const b = g.capy.body;
      b.position.set(sp.x, sp.y, sp.z);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position);
      b.interpolatedPosition.copy(b.position);
    };
  });
  const names = ['quay','kyoto','cali','rio','iceland','sahara','drift','venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic'];
  for (const n of names) {
    await page.evaluate((nm) => window.__qaGo(nm), n);
    await page.waitForTimeout(900);
    out.pairs[n] = await page.evaluate((nm) => {
      const L = (window.__capy.locals || []).filter(r => r.biome === nm);
      let best = 1e9, n2 = 0, n5 = 0, n9 = 0;
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
        const d = Math.hypot(L[i].ax - L[j].ax, L[i].az - L[j].az);
        if (d < best) best = d;
        if (d < 3) n2++;
        if (d < 4.6) n5++;
        if (d < 9) n9++;
      }
      return { n: L.length, closest: L.length > 1 ? +best.toFixed(2) : -1, under46: n5, under9: n9 };
    }, n);
  }
  out.err = await page.evaluate(() => String(window.__capy.state.lastError));
  await page.evaluate((o) => fetch('/shot?name=w34f.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
