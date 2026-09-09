async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy
    const b = g.capy.body
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
    g.biome.switchTo('kowloon')
    b.position.set(7.2, 1.4, -8); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i=0;i<120;i++) g.tick(1/60,false)
    const held = new Set()
    const setk = (want) => { for (const k of ['KeyW','KeyA','KeyS','KeyD']) {
      if (want.has(k) && !held.has(k)) { down(k); held.add(k) }
      if (!want.has(k) && held.has(k)) { up(k); held.delete(k) } } }
    const tx = 7.2, tz = -40
    const path = []
    for (let i=0;i<60*26;i++) {
      if (i % 6 === 0) {
        const p = g.capy.position
        const dx = tx - p.x, dz = tz - p.z
        const cy = Math.cos(g.input.camYaw), sy = Math.sin(g.input.camYaw)
        const f = -(dx * sy + dz * cy), r = (dx * cy - dz * sy)
        const want = new Set()
        if (f > 0.35) want.add('KeyW'); else if (f < -0.35) want.add('KeyS')
        if (r > 0.35) want.add('KeyD'); else if (r < -0.35) want.add('KeyA')
        setk(want)
      }
      g.tick(1/60,false)
      if (i % 60 === 0) { const p = g.capy.position; path.push([+p.x.toFixed(1), +p.z.toFixed(1)]) }
    }
    setk(new Set())
    return path
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=t4path.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
