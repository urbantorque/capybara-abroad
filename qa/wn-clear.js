async page => {
  await page.reload(); await page.waitForTimeout(5000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('kowloon')
    const b = g.capy.body
    b.position.set(0, 1.4, 34); b.velocity.set(0,0,0)
    for (let i=0;i<90;i++) g.tick(1/60,false)
    // every static/kinematic collider shape as a world AABB, per shape
    const boxes = []
    const V = new g.CANNON.Vec3()
    for (const bd of g.world.bodies) {
      if (bd.mass > 0 && bd.type !== 4) continue
      for (let si = 0; si < bd.shapes.length; si++) {
        const sh = bd.shapes[si]
        const t = sh.constructor && sh.constructor.name
        if (t !== 'Box') continue
        const off = bd.shapeOffsets[si]
        bd.quaternion.vmult(off, V)
        const cx = bd.position.x + V.x, cy = bd.position.y + V.y, cz = bd.position.z + V.z
        // ignore rotation for the AABB — every collider on this street is axis-aligned
        const he = sh.halfExtents
        boxes.push([cx - he.x, cy - he.y, cz - he.z, cx + he.x, cy + he.y, cz + he.z])
      }
    }
    // the walkable width of each pavement, and of the road, every half metre
    const R = 0.5                                    // the animal's half-width
    const scan = (x0, x1, label) => {
      const worst = []
      for (let z = -42; z <= 58; z += 0.5) {
        let best = 0, run = 0
        for (let x = x0; x <= x1; x += 0.1) {
          let blocked = false
          for (const q of boxes) {
            if (x > q[0] - R && x < q[3] + R && z > q[2] - R && z < q[5] + R &&
                q[1] < 0.9 && q[4] > 0.15) { blocked = true; break }
          }
          if (blocked) { run = 0 } else { run += 0.1; if (run > best) best = run }
        }
        if (best < 1.0) worst.push([+z.toFixed(1), +best.toFixed(2)])
      }
      return { label, tight: worst.length, worst: worst.slice(0, 14) }
    }
    return [scan(6.6, 10.4, 'east pavement'), scan(-10.4, -6.6, 'west pavement'),
            scan(-6.2, 6.2, 'roadway')]
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=wn.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
