async page => {
  const st = await page.evaluate(() => !!(window.__capy && window.__capy.state.started))
  if (!st) {
    await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
    for (let i = 0; i < 120; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capyRunning && document.querySelector('.capyui-go')))) break }
    await page.waitForTimeout(1500)
    await page.evaluate(() => { const b = document.querySelector('.capyui-go:not(.alt)') || document.querySelector('.capyui-carry'); if (b) b.click() })
    for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
    await page.waitForTimeout(4000)
  }
  await page.evaluate(() => {
    if (window.__l7st) return
    window.__l7st = { writes: [], long: [], t0: performance.now() }
    const si = Storage.prototype.setItem
    Storage.prototype.setItem = function (k, v) { const t = performance.now(); const r = si.call(this, k, v); window.__l7st.writes.push([+(t - window.__l7st.t0).toFixed(0), k, (v || '').length, +(performance.now() - t).toFixed(2)]); return r }
    // a long-frame recorder that runs for the whole probe
    let last = performance.now()
    const f = (t) => { const gap = t - last; last = t; if (gap > 40) window.__l7st.long.push([+(t - window.__l7st.t0).toFixed(0), +gap.toFixed(0)]); requestAnimationFrame(f) }
    requestAnimationFrame(f)
  })
  const out = { chapters: [] }
  for (const n of ['sydney', 'venice']) {
    await page.evaluate(async (name) => { const g = window.__capy; if (g.biome.current !== name) { g.hud.cross(name); await new Promise(r => setTimeout(r, 8000)) } window.__l7st.mark = performance.now() - window.__l7st.t0 }, n)
    // 45 s of play: walk, wheek every 9 s, hop now and then, to make the game tick rows and write
    for (let i = 0; i < 5; i++) {
      await page.keyboard.down('KeyW'); await page.waitForTimeout(3500); await page.keyboard.up('KeyW')
      await page.keyboard.press('KeyQ'); await page.waitForTimeout(600)
      await page.keyboard.press('Space'); await page.waitForTimeout(1200)
      await page.keyboard.down('KeyA'); await page.waitForTimeout(1500); await page.keyboard.up('KeyA')
      await page.keyboard.down('KeyW'); await page.waitForTimeout(2200); await page.keyboard.up('KeyW')
    }
    const r = await page.evaluate((name) => {
      const g = window.__capy, s = window.__l7st
      const since = s.mark
      const writes = s.writes.filter(w => w[0] >= since)
      const long = s.long.filter(l => l[0] >= since)
      // for each long frame, is there a write within 40 ms before it
      const near = long.map(l => { const w = writes.find(w => w[0] <= l[0] && w[0] >= l[0] - l[1] - 5); return [l[0], l[1], w ? w[1] + ':' + w[2] + 'B/' + w[3] + 'ms' : null] })
      const byKey = {}
      for (const w of writes) { const b = byKey[w[1]] || (byKey[w[1]] = { n: 0, bytes: 0, msMax: 0, msSum: 0 }); b.n++; b.bytes = Math.max(b.bytes, w[2]); b.msMax = Math.max(b.msMax, w[3]); b.msSum += w[3] }
      const iv = []; for (let i = 1; i < long.length; i++) iv.push(long[i][0] - long[i - 1][0])
      return { biome: g.biome.current, secs: +((performance.now() - s.t0 - since) / 1000).toFixed(1), writes: writes.length, byKey, long: near.slice(0, 40), longN: long.length, longIntervals: iv.slice(0, 30), lastError: g.state.lastError || null, rung: g.state.perfRung }
    }, n)
    out.chapters.push(r)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=l7r-qa-timers.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
