async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const b = g.capy.body
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
    // steer toward a target, camera-relative, closed loop
    const goto = (tx, tz, secs, opts) => {
      const held = new Set()
      const setk = (want) => {
        for (const k of ['KeyW','KeyA','KeyS','KeyD']) {
          if (want.has(k) && !held.has(k)) { down(k); held.add(k) }
          if (!want.has(k) && held.has(k)) { up(k); held.delete(k) }
        }
      }
      let minD = 1e9, stuck = 0, lx = 0, lz = 0
      const n = 60 * secs
      for (let i = 0; i < n; i++) {
        if (i % 6 === 0) {
          const p = g.capy.position
          const dx = tx - p.x, dz = tz - p.z
          const cy = Math.cos(g.input.camYaw), sy = Math.sin(g.input.camYaw)
          // forward = (-sin, -cos) in this game's convention; project
          const f = -(dx * sy + dz * cy), r = (dx * cy - dz * sy)
          const want = new Set()
          if (f > 0.35) want.add('KeyW'); else if (f < -0.35) want.add('KeyS')
          if (r > 0.35) want.add('KeyD'); else if (r < -0.35) want.add('KeyA')
          setk(want)
        }
        g.tick(1/60, false)
        const p = g.capy.position
        const d = Math.hypot(p.x - tx, p.z - tz)
        if (d < minD) minD = d
        if (Math.hypot(p.x - lx, p.z - lz) < 0.004) stuck++
        lx = p.x; lz = p.z
        if (d < 2.0) break
      }
      setk(new Set())
      const p = g.capy.position
      return { minD: +minD.toFixed(2), stuck, end: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)] }
    }
    const res = {}
    // VENICE at the top of the tide: the duckboard route out of the square
    g.biome.switchTo('venice')
    b.position.set(-4, 1.6, 8); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i=0;i<60*115;i++){ g.tick(1/60,false); b.position.set(-4,1.6,8); b.velocity.set(0,0,0) }
    res.tide = +g.venice.tide().toFixed(2)
    res.boards = +g.venice.boardsOut().toFixed(2)
    res.legA = goto(-4, -12, 26)
    res.legB = goto(-14, -31, 26)
    res.legC = goto(-28, -31, 26)
    res.legD = goto(-38, -30, 22)
    res.legE = goto(-48, -27, 22)
    res.legF = goto(-54, -24, 22)
    // KOWLOON: down the pavement past the new dai pai dong
    g.biome.switchTo('kowloon')
    b.position.set(7.5, 1.4, -8); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i=0;i<120;i++) g.tick(1/60,false)
    res.hkPave = goto(7.5, -36, 30)
    // DRIFT: across the Shelf past the new house
    g.biome.switchTo('drift')
    b.position.set(2, 31.6, 42); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i=0;i<120;i++) g.tick(1/60,false)
    res.driShelf = goto(-10, 36, 22)
    res.driJetty = goto(28, 34, 26)
    res.lastError = g.state && g.state.lastError || null
    return res
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=t4walk.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
