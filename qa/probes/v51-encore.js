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
    const oT = g.toast
    g.toast = function (s) { W.__log.push('toast: ' + s); return oT.apply(g, arguments) }
    let sfxN = 0
    const oS = g.sfx
    g.sfx = function (n) { if (n === 'tick') sfxN++; return oS.apply(g, arguments) }
    W.__ticks = () => sfxN
    g.events.on('task:complete', e => W.__log.push('TASK: ' + (e && e.id)))
    g.biome.switchTo('kyoto')
    await sleep(2500)
    W.__gates = []
    for (let i = 0; i < 44; i++) {
      const t = i / 43
      W.__gates.push({ x: (-6 + (-34 + 4 + 6) * t) + Math.sin(t * 4.4) * 6.5, z: -46 + (-128 + 26 + 46) * t })
    }
    W.__walk = async label => {
      const api = g.kyoto, cb = g.capy.body
      const t0 = sfxN
      for (let i = 0; i < 44; i++) {
        const q = W.__gates[i]
        const y = api && api.terrainHeight ? api.terrainHeight(q.x, q.z) : 0
        cb.position.set(q.x, (isFinite(y) ? y : 0) + 0.9, q.z)
        cb.velocity.set(0, 0, 0)
        cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
        await sleep(160)
      }
      await sleep(700)
      let recs = {}
      try { recs = (JSON.parse(localStorage.getItem('capy3.journey.v1') || '{}').recs) || {} } catch (e) {}
      return { label, gateTicks: sfxN - t0, recs: recs['torii-run'], log: W.__log.slice(-4) }
    }
  })
  const one = await page.evaluate(() => window.__walk('run 1'))
  await page.waitForTimeout(2000)
  const two = await page.evaluate(() => window.__walk('run 2'))
  await page.waitForTimeout(2000)
  const three = await page.evaluate(() => window.__walk('run 3'))
  await page.evaluate(o => fetch('/shot?name=v51encore.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), [one, two, three])
}
