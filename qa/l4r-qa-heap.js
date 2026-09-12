async page => {
  await page.reload();
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  const out = {};
  for (const n of ['sydney', 'hanoi']) {
    await page.evaluate((name) => { window.__capy.hud.cross(name); }, n);
    await page.waitForTimeout(4500);
    await page.evaluate(() => {
      const g = window.__capy;
      const S = { heap: [], tick: [], t0: performance.now(), gcDrops: 0, lastHeap: 0, frames: 0, longFrames: 0, lastF: 0 };
      const rawTick = g.tick;
      g.tick = function (dt, r) { const a = performance.now(); if (S.lastF && a - S.lastF > 100) S.longFrames++; S.lastF = a; const o = rawTick.call(g, dt, r); S.tick.push([a - S.t0, performance.now() - a]); S.frames++; return o; };
      S.sampler = setInterval(() => { const h = performance.memory ? performance.memory.usedJSHeapSize / 1048576 : -1; if (S.lastHeap && h < S.lastHeap - 5) S.gcDrops++; S.lastHeap = h; S.heap.push([+((performance.now() - S.t0) / 1000).toFixed(0), +h.toFixed(1)]); }, 5000);
      const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
      const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
      down('KeyW');
      let k = 0;
      S.timer = setInterval(() => { k++; const key = (k & 1) ? 'KeyA' : 'KeyD'; down(key); setTimeout(() => up(key), 900); if (k % 3 === 0) { down('Space'); setTimeout(() => up('Space'), 120); } if (k % 5 === 0) { down('KeyQ'); setTimeout(() => up('KeyQ'), 100); } }, 3000);
      g.__l4h = { S, rawTick };
    });
    for (let i = 0; i < 18; i++) await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));
    out[n] = await page.evaluate(() => {
      const g = window.__capy, L = g.__l4h, S = L.S;
      const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
      up('KeyW'); up('KeyA'); up('KeyD');
      clearInterval(S.timer); clearInterval(S.sampler); g.tick = L.rawTick;
      const mean = arr => arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 0;
      const early = S.tick.filter(x => x[0] < 15000).map(x => x[1]), late = S.tick.filter(x => x[0] > 75000).map(x => x[1]);
      return { biome: g.biome.current, frames: S.frames, longFrames: S.longFrames, heap: S.heap, gcDrops: S.gcDrops, tickEarly: mean(early), tickLate: mean(late), props: g.props.length, bodies: g.world.bodies.length, children: g.scene.children.length, err: g.state.lastError || null, pos: [+g.capy.position.x.toFixed(1), +g.capy.position.z.toFixed(1)] };
    });
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4r-qa-heap.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
