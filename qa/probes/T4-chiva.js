async page => {
  await page.reload()
  await page.waitForTimeout(5600)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(2600)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('cali')
    const sp = g.biome.spawnOf('cali')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2600))
    const C = g.cali
    if (!C || !C.chivaDebug) return { missing: true }
    const start = C.chivaDebug()
    C.chivaToTop()
    const atTop = C.chivaDebug()
    const seen = [], marks = []
    let lastSt = ''
    const t0 = Date.now()
    while (Date.now() - t0 < 110000) {
      await new Promise(r => setTimeout(r, 350))
      const d = C.chivaDebug()
      if (d.st !== lastSt) {
        lastSt = d.st
        seen.push(d.st)
        marks.push({ st: d.st, t: Math.round((Date.now() - t0) / 100) / 10,
                     s: d.s, v: d.v, armed: d.wiresArmed })
      }
      // stand well clear so she is EMPTY and will turn round; then get back on
      // her once she is parked again, to prove the ride can start a second time
      if (d.st === 'parked' && seen.length >= 3) {
        g.capy.body.position.set(d.x, d.y + 4.2, d.z)
      } else {
        g.capy.body.position.set(0, 40, 0)
      }
      if (seen.length >= 4) break
    }
    return { start, atTop, seen, marks, end: C.chivaDebug(), err: g.state.lastError || null }
  })
  await page.evaluate(o => fetch('/shot?name=T4-chiva.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
