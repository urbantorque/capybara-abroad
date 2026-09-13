async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const out = {}
  for (const mode of ['noWarm', 'warm']) {
    await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForTimeout(5000)
    await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
    await page.waitForTimeout(6000)
    await page.evaluate((m) => { window.__capy.state.noWarm = m === 'noWarm' }, mode)
    out[mode] = {}
    for (const name of ['palawan', 'antarctic', 'kowloon']) {
      out[mode][name] = await page.evaluate(async (name) => {
        const g = window.__capy, r = g.renderer
        const rec = {}
        const os = g.biome.switchTo.bind(g.biome)
        g.biome.switchTo = function (n) { const t = performance.now(); const x = os(n); rec.switchMs = +(performance.now() - t).toFixed(0); return x }
        const oc = r.compile.bind(r)
        r.compile = function (a, b, c) { const t = performance.now(); const m = oc(a, b, c); rec.compileMs = +(performance.now() - t).toFixed(0); return m }
        const oe = g.events.emit.bind(g.events)
        g.events.emit = function (ev, p) { const t = performance.now(); const x = oe(ev, p); if (ev === 'biome:enter') rec.enterMs = +(performance.now() - t).toFixed(0); return x }
        const t0 = performance.now(); let last = t0, big = 0
        const p = new Promise(res => { const f = t => { const gap = t - last; last = t; if (gap > big) big = gap; if (t - t0 < 5000) requestAnimationFrame(f); else res() }; requestAnimationFrame(f) })
        g.hud.cross(name)
        await p
        g.biome.switchTo = os; r.compile = oc; g.events.emit = oe
        rec.maxGap = +big.toFixed(0); rec.warmMs = g.state.warmMs; rec.rung = g.state.perfRung
        return rec
      }, name)
    }
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=l6-parts.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
