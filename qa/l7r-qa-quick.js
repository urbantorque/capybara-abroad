async page => {
  const r = await page.evaluate(async () => {
    const g = window.__capy
    const t0 = performance.now(); const gaps = []; let last = t0
    await new Promise(res => { const f = (t) => { gaps.push(t - last); last = t; if (t - t0 < 5000) requestAnimationFrame(f); else res() }; requestAnimationFrame(f) })
    gaps.shift(); gaps.sort((a, b) => a - b)
    const q = (u) => +gaps[Math.min(gaps.length - 1, Math.floor(u * gaps.length))].toFixed(1)
    return { biome: g.biome.current, n: gaps.length, p50: q(0.5), p95: q(0.95), max: +gaps[gaps.length - 1].toFixed(0), rung: g.state.perfRung, calls: g.state.perf.calls, tris: g.state.perf.triangles, t: new Date().toISOString().slice(11, 19) }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=l7r-qa-quick.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, r)
}
