async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy
    const o = { compass: {} }
    g.biome.switchTo('sahara')
    const b = g.capy.body, sa = g.sahara
    const park = (x, z) => { const y = sa.terrainHeight(x, z) + 1.0
      b.position.set(x, y, z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 60; i++) { g.input.x = 0; g.input.z = 0; g.input.run = false; g.tick(1 / 60, false) } }
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4
      park(7.0, 3.4)
      const p0 = { x: g.capy.position.x, z: g.capy.position.z }
      for (let i = 0; i < 150; i++) { g.input.camYaw = 0; g.input.x = Math.sin(a); g.input.z = Math.cos(a)
        g.input.run = true; g.tick(1 / 60, false) }
      o.compass[Math.round(a * 180 / Math.PI)] = +Math.hypot(g.capy.position.x - p0.x, g.capy.position.z - p0.z).toFixed(1)
    }
    // is anything solid there? list physics bodies within 6 m of (7,3.4)
    o.bodies = []
    const W = g.world
    for (const bb of W.bodies) {
      const d = Math.hypot(bb.position.x - 7, bb.position.z - 3.4)
      if (d < 6 && bb !== b) o.bodies.push({ d: +d.toFixed(1), m: bb.mass,
        y: +bb.position.y.toFixed(1), type: bb.shapes && bb.shapes[0] ? bb.shapes[0].constructor.name : '?' })
    }
    o.bodies.sort((p, q) => p.d - q.d)
    o.bodies = o.bodies.slice(0, 12)
    o.totalBodies = W.bodies.length
    return o
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=b3sah-i.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
