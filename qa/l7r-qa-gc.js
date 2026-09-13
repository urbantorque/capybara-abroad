async page => {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  const out = { chapters: [] }
  for (const n of ['venice', 'kowloon']) {
    await page.evaluate(async (name) => { const g = window.__capy; if (g.biome.current !== name) { g.hud.cross(name); await new Promise(r => setTimeout(r, 8000)) } }, n)
    await page.keyboard.down('KeyW')
    const m0 = (await cdp.send('Performance.getMetrics')).metrics.reduce((a, m) => (a[m.name] = m.value, a), {})
    const r = await page.evaluate(async () => {
      const g = window.__capy
      const pm = performance.memory
      const t0 = performance.now(); let last = t0
      const long = [], heap = []
      let lastHeap = pm ? pm.usedJSHeapSize : 0
      await new Promise(res => { const f = (t) => { const gap = t - last; last = t; if (gap > 40) long.push([+(t - t0).toFixed(0), +gap.toFixed(0)]); if (pm) { const h = pm.usedJSHeapSize; if (h !== lastHeap) { heap.push([+(t - t0).toFixed(0), +(h / 1048576).toFixed(1), +((h - lastHeap) / 1048576).toFixed(1)]); lastHeap = h } } if (t - t0 < 25000) requestAnimationFrame(f); else res() }; requestAnimationFrame(f) })
      const drops = heap.filter(h => h[2] < -2)
      // each long frame: nearest heap drop within 300 ms
      const paired = long.map(l => { const d = drops.find(d => Math.abs(d[0] - l[0]) < 300); return [l[0], l[1], d ? d[2] : null] })
      return { biome: g.biome.current, long: paired, longN: long.length, drops: drops.slice(0, 20), dropsN: drops.length, heapNow: pm ? +(pm.usedJSHeapSize / 1048576).toFixed(0) : null, rung: g.state.perfRung }
    })
    await page.keyboard.up('KeyW')
    const m1 = (await cdp.send('Performance.getMetrics')).metrics.reduce((a, m) => (a[m.name] = m.value, a), {})
    r.cdp = { JSHeapUsedMB: +(m1.JSHeapUsedSize / 1048576).toFixed(0), JSHeapTotalMB: +(m1.JSHeapTotalSize / 1048576).toFixed(0), nodes: m1.Nodes, jsEventListeners: m1.JSEventListeners, taskDurS: +(m1.TaskDuration - m0.TaskDuration).toFixed(2), scriptS: +(m1.ScriptDuration - m0.ScriptDuration).toFixed(2), layoutS: +(m1.LayoutDuration - m0.LayoutDuration).toFixed(3), styleS: +(m1.RecalcStyleDuration - m0.RecalcStyleDuration).toFixed(3), layoutCount: m1.LayoutCount - m0.LayoutCount, styleCount: m1.RecalcStyleCount - m0.RecalcStyleCount }
    out.chapters.push(r)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=l7r-qa-gc.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
