async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 160)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(7000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
    const g = window.__capy
    const log = { events: [], says: [], sfx: [] }
    g.events.on('task:complete', e => log.events.push({ t: 'task', id: e && e.id, at: Date.now() }))
    const rawSfx = g.sfx.bind(g)
    g.sfx = function (n, o) {
      log.sfx.push({ n: n, pos: !!(o && (o.at || typeof o.x === 'number')), v: o && o.volume })
      return rawSfx(n, o)
    }
    g.biome.switchTo('pantanal')
    await sleep(1200)
    const api = g.pantanal
    const b = g.capy.body
    const put = (x, z) => {
      const y = api.terrainHeight(x, z) + 0.5
      b.position.set(x, y, z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }
    // ---- recruit five: stand next to each grazer and wheek
    const spots = [[-14,34],[-9,30],[-17,27],[-6,24],[-24,40]]
    for (const s of spots) {
      put(s[0] + 1.2, s[1] + 1.2)
      for (let i = 0; i < 8; i++) g.tick(0.05, false)
      g.events.emit('capy:wheek', {})
      for (let i = 0; i < 8; i++) g.tick(0.05, false)
    }
    const recruited = api.following()
    // ---- walk to the crossing head, laying a trail
    const path = []
    let cx = -23, cz = 40
    put(cx, cz)
    const goto = (tx, tz) => {
      while (Math.hypot(tx - cx, tz - cz) > 0.4) {
        const d = Math.hypot(tx - cx, tz - cz), k = Math.min(1, 0.45 / d)
        cx += (tx - cx) * k; cz += (tz - cz) * k
        put(cx, cz)
        g.tick(1 / 30, false)
      }
    }
    goto(-34, 0); goto(-34, -50)
    const beforeRiver = { following: api.following(), n: log.events.length }
    // ---- and across
    const shots = []
    let fired = null
    while (cz > -90) {
      cz -= 0.45
      put(cx, cz)
      g.tick(1 / 30, false)
      if (!fired && log.events.some(e => e.id === 'the-crossing')) {
        fired = { z: cz, following: api.following() }
        break
      }
    }
    // let the render rig settle on the payout, real frames
    return { recruited: recruited, beforeRiver: beforeRiver, fired: fired,
             dusk: api.dusk(), events: log.events.map(e => e.id),
             sfxAtPayout: log.sfx.slice(-14),
             monoCount: log.sfx.filter(s => !s.pos).length,
             posCount: log.sfx.filter(s => s.pos).length,
             framing: typeof g.framing === 'function' ? g.framing() : null,
             capy: { x: g.capy.position.x, y: g.capy.position.y, z: g.capy.position.z },
             cam: { x: g.camera.position.x, y: g.camera.position.y, z: g.camera.position.z },
             locals: (g.npcs || []).filter(n => n.biome === 'pantanal')
               .map(n => ({ x: n.x, z: n.z, d: Math.hypot(g.capy.position.x - n.x, g.capy.position.z - n.z).toFixed(1) })) }
  })
  out.errs = errs
  await page.evaluate(async o => { await fetch('/shot?name=b4pan-2.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
