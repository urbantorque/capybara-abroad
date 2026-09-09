async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  await page.evaluate(() => {
    const g = window.__capy
    const W = window
    W.__log = []
    W.__pops = 0
    const oT = g.toast
    g.toast = function (s) { W.__log.push('toast: ' + s); return oT.apply(g, arguments) }
    const oS = g.sfx
    g.sfx = function (n) { if (n === 'pop') W.__pops++; return oS.apply(g, arguments) }
    g.events.on('task:complete', e => W.__log.push('TASK: ' + (e && e.id)))
    W.__recs = () => { try { return (JSON.parse(localStorage.getItem('capy3.journey.v1') || '{}').recs) || {} } catch (e) { return {} } }
  })
  // ---- Kyoto: the six stepping stones, twice ----
  await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const g = window.__capy
    g.biome.switchTo('kyoto')
    await sleep(2500)
    const api = g.kyoto
    const PAV = api.pond ? null : null
    // kyoStoneAt: pavilion.x - 9 - i*2.6, pavilion.z - 8 + sin(i*1.3)*1.6
    const P = { x: 30, z: -12 }
    window.__walkStones = async () => {
      const cb = g.capy.body
      const p0 = window.__pops
      for (let i = 5; i >= 0; i--) {
        const sx = P.x - 9 - i * 2.6, sz = P.z - 8 + Math.sin(i * 1.3) * 1.6
        const y = api.terrainHeight ? api.terrainHeight(sx, sz) : 0
        cb.position.set(sx, Math.max(isFinite(y) ? y : 0, 0) + 1.0, sz)
        cb.velocity.set(0, 0, 0)
        cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
        await sleep(220)
      }
      const y2 = api.terrainHeight ? api.terrainHeight(P.x, P.z) : 0
      cb.position.set(P.x, (isFinite(y2) ? y2 : 0) + 1.0, P.z)
      cb.velocity.set(0, 0, 0)
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
      await sleep(900)
      return window.__pops - p0
    }
  })
  const k1 = await page.evaluate(() => window.__walkStones())
  const k1log = await page.evaluate(() => window.__log.slice(-3))
  await page.waitForTimeout(1500)
  const k2 = await page.evaluate(() => window.__walkStones())
  const k2log = await page.evaluate(() => window.__log.slice(-3))
  await page.evaluate(o => fetch('/shot?name=v53enc2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }),
    { kyotoStones: [{ run: 1, pops: k1, log: k1log }, { run: 2, pops: k2, log: k2log }] })
}
