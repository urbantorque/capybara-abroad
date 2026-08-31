async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const g = window.__capy
    const W = window
    W.__log = []
    W.__rustle = 0
    const oT = g.toast
    g.toast = function (s) { W.__log.push('toast: ' + s); return oT.apply(g, arguments) }
    const oS = g.sfx
    g.sfx = function (n) { if (n === 'rustle') W.__rustle++; return oS.apply(g, arguments) }
    g.events.on('task:complete', e => W.__log.push('TASK: ' + (e && e.id)))
    g.biome.switchTo('cali')
    await sleep(2500)
    const api = g.cali
    const CANE = { x0: 62, x1: 168, z0: -46, z1: 74 }
    const zz = (CANE.z0 + CANE.z1) / 2
    W.__cross = async fromEast => {
      const cb = g.capy.body
      const r0 = W.__rustle
      const startX = fromEast ? CANE.x1 - 3 : CANE.x0 + 3
      const endX = fromEast ? CANE.x0 + 3 : CANE.x1 - 3
      const steps = 24
      for (let i = 0; i <= steps; i++) {
        const x = startX + (endX - startX) * (i / steps)
        const y = api.terrainHeight ? api.terrainHeight(x, zz) : 0
        cb.position.set(x, (isFinite(y) ? y : 0) + 1.0, zz)
        cb.velocity.set(0, 0, 0)
        cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
        await sleep(90)
      }
      await sleep(600)
      let recs = {}
      try { recs = (JSON.parse(localStorage.getItem('capy3.journey.v1') || '{}').recs) || {} } catch (e) {}
      return { rustles: W.__rustle - r0, rec: recs['cane-run'], log: W.__log.slice(-2) }
    }
  })
  const a = await page.evaluate(() => window.__cross(true))
  await page.waitForTimeout(1500)
  // out of the field and back in from the other side: a second attempt
  const b = await page.evaluate(() => window.__cross(false))
  await page.evaluate(o => fetch('/shot?name=v53cane2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), [a, b])
}
