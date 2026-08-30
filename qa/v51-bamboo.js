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
    g.events.on('task:complete', e => W.__log.push('TASK: ' + (e && e.id)))
    g.biome.switchTo('kyoto')
    const cb = g.capy.body
    await sleep(2000)
    const api = g.kyoto
    const B = { x: -84, z: -44, hx: 26, hz: 34 }
    const sx = B.x, sz = B.z + B.hz - 1
    const y = api && api.terrainHeight ? api.terrainHeight(sx, sz) : 0
    cb.position.set(sx, (isFinite(y) ? y : 0) + 1.0, sz)
    cb.velocity.set(0, 0, 0)
    cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
    await sleep(2000)
    const keys = { KeyW: 0, KeyA: 0, KeyS: 0, KeyD: 0, ShiftLeft: 0 }
    const set = (c, v) => {
      if (keys[c] === v) return
      keys[c] = v
      window.dispatchEvent(new KeyboardEvent(v ? 'keydown' : 'keyup', { code: c, bubbles: true }))
    }
    W.__stop = () => { for (const c of Object.keys(keys)) set(c, 0) }
    W.__t0 = performance.now()
    W.__drive = setInterval(() => {
      const p = g.capy.position
      const dx = B.x - p.x, dz = (B.z - B.hz - 2) - p.z
      const yaw = g.input.camYaw || 0
      const cy = Math.cos(yaw), sy = Math.sin(yaw)
      const len = Math.hypot(dx, dz) || 1
      const Dx = dx / len, Dz = dz / len
      const ix = cy * Dx - sy * Dz
      const iz = sy * Dx + cy * Dz
      set('KeyD', ix > 0.3 ? 1 : 0)
      set('KeyA', ix < -0.3 ? 1 : 0)
      set('KeyS', iz > 0.3 ? 1 : 0)
      set('KeyW', iz < -0.3 ? 1 : 0)
      set('ShiftLeft', 1)
    }, 33)
  })
  const samples = []
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(4000)
    const s = await page.evaluate(() => {
      const g = window.__capy
      return { z: Math.round(g.capy.position.z), x: Math.round(g.capy.position.x), log: window.__log.slice(-2) }
    })
    samples.push(s)
    if (s.log.some(l => /bamboo|grove will recover/i.test(l))) break
  }
  const out = await page.evaluate(() => {
    window.__stop(); clearInterval(window.__drive)
    let recs = {}
    try { recs = (JSON.parse(localStorage.getItem('capy3.journey.v1') || '{}').recs) || {} } catch (e) {}
    return { log: window.__log.slice(-8), secs: Math.round((performance.now() - window.__t0) / 100) / 10, recs }
  })
  await page.evaluate(o => fetch('/shot?name=v51bamboo.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), { samples, out })
}
