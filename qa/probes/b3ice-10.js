async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy, I = g.iceland, R = {}
    g.biome.switchTo('iceland')
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
    const b = g.capy.body
    // ---- the run: top of the ice, on the centre line, no input ----
    const runs = []
    for (const x0 of [-16, -30, 0]) {
      const y = I.terrainHeight(x0, -178) + 1.0
      b.position.set(x0, y, -178)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      b.velocity.set(0, 0, 0)
      g.input.x = 0; g.input.z = 0
      let top = 0, t = 0, ended = -1
      for (let i = 0; i < 60 * 45; i++) {
        g.tick(1 / 60, false)
        t += 1 / 60
        const sp = Math.hypot(g.capy.velocity.x, g.capy.velocity.z)
        if (sp > top) top = sp
        if (ended < 0 && g.capy.position.z > -82) ended = +t.toFixed(1)
      }
      runs.push({ x0, endX: +g.capy.position.x.toFixed(1), endZ: +g.capy.position.z.toFixed(1),
                  topSpeed: +top.toFixed(1), sec: ended,
                  done: g.hud.isTaskDone('glacier-run') })
    }
    R.runs = runs
    // ---- the cat: where is it, and how long from the bottom of the run ----
    const cat0 = I.snowcat()
    let seen = [], minZ = 9e9, maxZ = -9e9
    for (let i = 0; i < 60 * 60; i++) {
      g.tick(1 / 60, false)
      const c = I.snowcat()
      if (c) { if (c.z < minZ) minZ = c.z; if (c.z > maxZ) maxZ = c.z }
      if (i % 60 === 0) seen.push(+I.snowcat().z.toFixed(0))
    }
    R.cat = { start: cat0 ? [+cat0.x.toFixed(1), +cat0.z.toFixed(1)] : null,
              minZ: +minZ.toFixed(0), maxZ: +maxZ.toFixed(0), track: seen }
    R.err = g.state.lastError ? String(g.state.lastError).slice(0, 200) : null
    return R
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=b3ice10.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
