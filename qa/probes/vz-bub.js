async page => {
  await page.reload()
  await page.waitForTimeout(4800)
  await page.keyboard.press('Minus')
  await page.waitForTimeout(9000)
  const panels = await page.evaluate(() => {
    const g = window.__capy, out = []
    g.hud.panels(out)
    return { panels: out.map(function (p) {
      return { x0: Math.round(p.x0 * 100) / 100, x1: Math.round(p.x1 * 100) / 100,
               y0: Math.round(p.y0 * 100) / 100, y1: Math.round(p.y1 * 100) / 100 } }),
      iw: innerWidth, ih: innerHeight }
  })
  await page.evaluate(() => {
    window.__hits = { seen: 0, over: 0, worst: 0 }
    window.__iv = setInterval(function () {
      const g = window.__capy, ps = []
      g.hud.panels(ps)
      const els = document.querySelectorAll('#hud > div')
      for (let i = 0; i < els.length; i++) {
        const e = els[i]
        if (e.style.display !== 'block') continue
        if (!/border-radius: 13px/.test(e.style.cssText)) continue
        const r = e.getBoundingClientRect()
        window.__hits.seen++
        for (let q = 0; q < ps.length; q++) {
          const p = ps[q]
          const px0 = (p.x0 * 0.5 + 0.5) * innerWidth, px1 = (p.x1 * 0.5 + 0.5) * innerWidth
          const py0 = (0.5 - p.y1 * 0.5) * innerHeight, py1 = (0.5 - p.y0 * 0.5) * innerHeight
          const ox = Math.min(r.right, px1) - Math.max(r.left, px0)
          const oy = Math.min(r.bottom, py1) - Math.max(r.top, py0)
          if (ox > 0 && oy > 0) {
            window.__hits.over++
            const a = ox * oy
            if (a > window.__hits.worst) window.__hits.worst = Math.round(a)
          }
        }
      }
    }, 100)
  })
  for (let k = 0; k < 12; k++) {
    await page.keyboard.press('KeyQ')
    await page.waitForTimeout(2500)
  }
  const hits = await page.evaluate(() => { clearInterval(window.__iv); return window.__hits })
  await page.evaluate(o => fetch('/shot?name=vz-bub-before.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), { panels: panels, hits: hits })
  await page.waitForTimeout(300)
}
