async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy
    const b = g.capy.body
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
    g.biome.switchTo('kowloon')
    const run = (x0, z0, yaw) => {
      b.position.set(x0, 1.4, z0); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<90;i++) { g.input.camYaw = yaw; g.tick(1/60,false) }
      down('KeyW')
      const path = []
      for (let i=0;i<60*16;i++) {
        g.input.camYaw = yaw
        // hold the lane: nudge x back to 7.0 the way a player would
        const p = g.capy.position
        if (p.x > 7.4) { down('KeyA'); up('KeyD') } else if (p.x < 6.7) { down('KeyD'); up('KeyA') }
        else { up('KeyA'); up('KeyD') }
        g.tick(1/60,false)
        if (i % 90 === 0) path.push([+p.x.toFixed(1), +p.z.toFixed(1)])
      }
      up('KeyW'); up('KeyA'); up('KeyD')
      const p = g.capy.position
      return { camYaw: +yaw.toFixed(2), path, end: [+p.x.toFixed(1), +p.z.toFixed(1)] }
    }
    return { yaw0: +g.input.camYaw.toFixed(2), a: run(7.0, -12, 0), b: run(7.0, -36, Math.PI) }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=t4lane.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
