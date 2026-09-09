async page => {
  // Is Sydney's Opera House keep-out volume live in the other eighteen
  // chapters? sysInOpera/sysOperaClear are gated on `!inPasto` and nothing
  // else, and Rio's spawn is the world ORIGIN — which is where Sydney's vault
  // table sits. Probed from outside: park the animal at each chapter's spawn,
  // let the rig settle, and read the eye's height above it.
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);
  const names = await page.evaluate(async () => {
    const src = await (await fetch('/src/shared.js', { cache: 'no-store' })).text();
    const i = src.indexOf('export const CHAPTERS = [');
    const k = [];
    for (const m of src.slice(i, src.indexOf('\n];', i)).matchAll(/\bbiome:\s*'([a-z]+)'/g)) k.push(m[1]);
    return k;
  });
  const out = {};
  for (const n of names) {
    await page.evaluate((name) => {
      const g = window.__capy;
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name), b = g.capy.body;
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    }, n);
    await page.waitForTimeout(2600);
    out[n] = await page.evaluate(() => new Promise(res => {
      const g = window.__capy, T = g.THREE, v = new T.Vector3();
      let i = 0, best = 0, pit = 0, ey = 0, dist = 0;
      const step = () => {
        g.camera.getWorldDirection(v);
        const p = Math.asin(Math.max(-1, Math.min(1, -v.y))) * 180 / Math.PI;
        if (p > pit) { pit = p; }
        ey = g.camera.position.y - g.capy.position.y;
        dist = Math.hypot(g.camera.position.x - g.capy.position.x,
                          g.camera.position.z - g.capy.position.z);
        if (++i < 45) requestAnimationFrame(step);
        else res({ pitch: +pit.toFixed(1), eyeAbove: +ey.toFixed(2), boomXZ: +dist.toFixed(2),
                   spawn: [g.capy.position.x.toFixed(1), g.capy.position.z.toFixed(1)] });
      };
      requestAnimationFrame(step);
    }));
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b5-opera.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
