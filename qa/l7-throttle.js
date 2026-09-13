async page => {
  // THE CPU-THROTTLE INSTRUMENT (L6 owed, E8): the same crossing and the same eight seconds of
  // walking, at 1x and at 4x CPU throttle (CDP Emulation.setCPUThrottlingRate — a slow laptop, not
  // a slow GPU). Per chapter: the crossing's longest frame, then p50 / p95 / max of the frame gap
  // while walking, the governor's rung, and the frames over 50 ms.
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  for (let i = 0; i < 120; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capyRunning && document.querySelector('.capyui-go')))) break }
  await page.waitForTimeout(1500)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
  await page.waitForTimeout(4000)
  const cdp = await page.context().newCDPSession(page)
  const names = ['quay', 'venice', 'hanoi', 'cave', 'pantanal', 'sydney']
  const out = { rates: {} }
  for (const rate of [1, 4]) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate })
    await page.waitForTimeout(1500)
    const rows = []
    for (const n of names) {
      const cross = await page.evaluate(async (name) => {
        const g = window.__capy
        const t0 = performance.now(); const gaps = []; let last = t0
        const p = new Promise(res => { const f = (t) => { gaps.push(t - last); last = t; if (t - t0 < 7000) requestAnimationFrame(f); else res() }; requestAnimationFrame(f) })
        g.hud.cross(name); await p
        return { maxGap: +Math.max.apply(null, gaps).toFixed(0), ok: g.biome.current === name }
      }, n)
      await page.keyboard.down('KeyW')
      const walk = await page.evaluate(async () => {
        const g = window.__capy
        const t0 = performance.now(); const gaps = []; let last = t0
        await new Promise(res => { const f = (t) => { gaps.push(t - last); last = t; if (t - t0 < 8000) requestAnimationFrame(f); else res() }; requestAnimationFrame(f) })
        gaps.shift(); gaps.sort((a, b) => a - b)
        const q = (u) => +gaps[Math.min(gaps.length - 1, Math.floor(u * gaps.length))].toFixed(1)
        return { p50: q(0.5), p95: q(0.95), max: +gaps[gaps.length - 1].toFixed(0), over50: gaps.filter(x => x > 50).length, frames: gaps.length,
                 rung: g.state.perfRung, calls: g.state.perf ? g.state.perf.calls : -1, err: g.state.lastError || null }
      })
      await page.keyboard.up('KeyW')
      rows.push(Object.assign({ biome: n }, cross, walk))
    }
    out.rates[rate] = rows
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  await page.evaluate(async (o) => { await fetch('/shot?name=l7-throttle.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
