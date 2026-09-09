async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(7000)
  await page.mouse.click(600, 400)
  await page.waitForTimeout(1500)
  // hand-tick to just before the bloom, with the animal parked over the reef
  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('palawan')
    const api = g.palawan, b = g.capy.body
    b.position.set(api.reef.x, 0.4, api.reef.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.input.x = 0; g.input.z = 0
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    let n = 0
    while (api.bloom() < 0.16 && n < 60 * 220) { g.input.action = true; g.tick(1 / 60, false); n++ }
    g.input.action = false
    window.__b4 = { warmTicks: n }
  })
  // hand over to the real clock, holding the dive
  await page.keyboard.down('e')
  // sample every frame until the payout, recording the camera AT the moment
  await page.evaluate(() => new Promise(res => {
    const g = window.__capy, api = g.palawan
    const o = { samples: [], payout: null, firedTimes: 0, lastDone: false }
    let t0 = performance.now()
    const id = setInterval(() => {
      const c = g.camera, p = g.capy.position
      const dx = c.position.x - p.x, dz = c.position.z - p.z, dy = c.position.y - p.y
      const dist = Math.hypot(dx, dz)
      const row = {
        t: +((performance.now() - t0) / 1000).toFixed(1),
        bloom: +api.bloom().toFixed(3), depth: +(g.capy.depth || 0).toFixed(2),
        sub: +api.submerged().toFixed(3),
        camY: +c.position.y.toFixed(2), capY: +p.y.toFixed(2),
        yaw: +Math.atan2(dx, dz).toFixed(3),      // bearing animal -> camera
        dist: +Math.hypot(dx, dy, dz).toFixed(2),
        pitch: +Math.atan2(dy, dist).toFixed(3),
        done: g.isTaskDone ? g.isTaskDone('the-bloom') : g.taskDone('the-bloom')
      }
      o.samples.push(row)
      if (row.done && !o.payout) o.payout = row
      if (o.samples.length > 200 || (o.payout && row.t - o.payout.t > 4)) {
        clearInterval(id); window.__b4res = o; res(0)
      }
    }, 100)
  }))
  await page.waitForTimeout(500)
  const out = await page.evaluate(() => {
    const g = window.__capy, api = g.palawan, o = window.__b4res || {}
    o.warm = window.__b4
    const p = g.capy.position
    // where the locals are, and how far from the payout point
    o.locals = []
    try {
      const ns = g.npc && g.npc.locals ? g.npc.locals() : null
      if (ns) for (const r of ns) o.locals.push({ id: r.id, x: +r.x.toFixed(1), z: +r.z.toFixed(1), d: +Math.hypot(r.x - p.x, r.z - p.z).toFixed(1) })
    } catch (e) { o.localsErr = String(e).slice(0, 120) }
    o.here = { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), bloom: +api.bloom().toFixed(3) }
    o.heat = typeof g.npcHeat === 'function' ? g.npcHeat(p.x, p.z, 40) : null
    o.lastError = g.state.lastError ? String(g.state.lastError).slice(0, 200) : null
    return o
  })
  out.pageErrors = errs.slice(0, 6)
  await page.evaluate(async d => {
    await fetch('/shot?name=b4pal-2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(d)))) })
  }, out)
}
