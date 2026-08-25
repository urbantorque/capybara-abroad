async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(7000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(async () => {
    function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
    const g = window.__capy
    window.__M = { snap: null, sfx: [] }
    g.events.on('task:complete', e => {
      if (e && e.id === 'the-crossing' && !window.__M.snap) {
        window.__M.snap = {
          capy: { x: g.capy.position.x, y: g.capy.position.y, z: g.capy.position.z },
          cam:  { x: g.camera.position.x, y: g.camera.position.y, z: g.camera.position.z },
          framing: g.framing ? g.framing() : null,
          dusk: g.pantanal.dusk(), following: g.pantanal.following()
        }
      }
    })
    g.biome.switchTo('pantanal')
    await sleep(1400)
    const api = g.pantanal, b = g.capy.body
    const put = (x, z) => {
      const y = api.terrainHeight(x, z) + 0.5
      b.position.set(x, y, z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }
    const spots = [[-14,34],[-9,30],[-17,27],[-6,24],[-24,40]]
    for (const s of spots) {
      put(s[0] + 1.2, s[1] + 1.2)
      for (let i = 0; i < 8; i++) g.tick(0.05, false)
      g.events.emit('capy:wheek', {})
      for (let i = 0; i < 8; i++) g.tick(0.05, false)
    }
    // lay a trail down to the near bank so the line is behind, not scattered
    let cx = -20, cz = 36
    put(cx, cz)
    const goto = (tx, tz) => {
      while (Math.hypot(tx - cx, tz - cz) > 0.4) {
        const d = Math.hypot(tx - cx, tz - cz), k = Math.min(1, 0.45 / d)
        cx += (tx - cx) * k; cz += (tz - cz) * k
        put(cx, cz); g.tick(1/30, false)
      }
    }
    goto(-34, 0); goto(-34, -48)
    window.__M.recruited = api.following()
  })
  // ---- align the lens to look SOUTH, then swim it, with real frames -------
  const camYaw = async () => page.evaluate(() => {
    const g = window.__capy
    return { yaw: Math.atan2(g.camera.position.x - g.capy.position.x, g.camera.position.z - g.capy.position.z),
             z: g.capy.position.z, x: g.capy.position.x, done: !!window.__M.snap }
  })
  for (let i = 0; i < 40; i++) {
    const s = await camYaw()
    if (Math.abs(s.yaw) < 0.09) break
    const k = s.yaw > 0 ? 'KeyX' : 'KeyZ'
    await page.keyboard.down(k); await page.waitForTimeout(60); await page.keyboard.up(k)
  }
  await page.keyboard.down('KeyW')
  let fired = false
  for (let i = 0; i < 120; i++) {
    await page.waitForTimeout(250)
    const s = await camYaw()
    if (s.done) { fired = true; break }
    if (Math.abs(s.yaw) > 0.30) {
      const k = s.yaw > 0 ? 'KeyX' : 'KeyZ'
      await page.keyboard.down(k); await page.waitForTimeout(50); await page.keyboard.up(k)
    }
  }
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(400)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const M = window.__M
    return { recruited: M.recruited, snap: M.snap,
             now: { capy: { x: g.capy.position.x, y: g.capy.position.y, z: g.capy.position.z },
                    cam: { x: g.camera.position.x, y: g.camera.position.y, z: g.camera.position.z },
                    framing: g.framing ? g.framing() : null, dusk: g.pantanal.dusk() } }
  })
  out.fired = fired
  await page.evaluate(async o => { await fetch('/shot?name=b4pan-4.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
