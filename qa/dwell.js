async page => {
  await page.evaluate(async () => {
    function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
    const g = window.__capy;
    g.biome.switchTo('sydney');
    await sleep(300);
    const b = g.capy.body; b.position.set(60, 1.2, 60); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    window.__dw = { durs: [], prev: new Map(), recs: g.npcs.filter(n => n.kind === 'tourist' || n.kind === 'gardener') };
    window.__dwTimer = setInterval(() => {
      const D = window.__dw;
      for (const r of D.recs) {
        const p = D.prev.get(r);
        if (p && p.state === 'idle' && r.state !== 'idle') D.durs.push(+p.t.toFixed(2));
        D.prev.set(r, { state: r.state, t: r.stateT });
      }
    }, 50);
  });
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));
  }
  const out = await page.evaluate(() => {
    clearInterval(window.__dwTimer);
    const d = window.__dw.durs.slice().sort((a, b) => a - b);
    const n = d.length;
    return { npcs: window.__capy.npcs.length, watched: window.__dw.recs.length, samples: n,
             min: d[0], p25: d[(n * 0.25) | 0], median: d[(n / 2) | 0], p75: d[(n * 0.75) | 0], max: d[n - 1],
             mean: +(d.reduce((a, b) => a + b, 0) / n).toFixed(2) };
  });
  await page.evaluate(async (o) => { await fetch('/shot?name=dwell.json',{method:'POST',body:btoa(JSON.stringify(o))}); }, out);
}
