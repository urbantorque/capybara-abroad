async page => {
  await page.reload(); await page.waitForTimeout(5500);
  await page.mouse.click(400, 400); await page.waitForTimeout(2500);
  const names = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                 'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic'];
  const out = {};
  for (const n of names) {
    out[n] = await page.evaluate(async (name) => {
      function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
      const g = window.__capy;
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name), b = g.capy.body;
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      await sleep(3200);
      const r = g.hud.roomAudit();
      return { for: r.biome, secs: +r.secs.toFixed(2), wet: +r.wet.toFixed(3), conv: r.conv, bus: r.bus };
    }, n);
  }
  out.err = await page.evaluate(() => String(window.__capy.state.lastError));
  await page.evaluate((o) => fetch('/shot?name=w34room.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
