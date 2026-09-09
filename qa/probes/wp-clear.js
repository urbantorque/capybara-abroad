async page => {
  await page.reload(); await page.waitForTimeout(5000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('venice')
    const b = g.capy.body
    b.position.set(-4, 1.4, 13); b.velocity.set(0,0,0)
    for (let i=0;i<90;i++) g.tick(1/60,false)
    const V = new g.CANNON.Vec3()
    const boxes = []
    for (const bd of g.world.bodies) {
      if (bd.mass > 0 && bd.type !== 4) continue
      for (let si = 0; si < bd.shapes.length; si++) {
        const sh = bd.shapes[si]
        if (!(sh.constructor && sh.constructor.name === 'Box')) continue
        const off = bd.shapeOffsets[si]
        bd.quaternion.vmult(off, V)
        const cx = bd.position.x + V.x, cy = bd.position.y + V.y, cz = bd.position.z + V.z
        const he = sh.halfExtents
        boxes.push([cx-he.x, cy-he.y, cz-he.z, cx+he.x, cy+he.y, cz+he.z])
      }
    }
    const api = g.venice
    const R = 0.5
    const scanZ = (x0, x1, z0, z1, label) => {          // corridor runs along z
      const worst = []
      for (let z = z0; z <= z1; z += 0.5) {
        let best = 0, run = 0
        for (let x = x0; x <= x1; x += 0.1) {
          const ty = api.terrainHeight(x, z)
          let blocked = false
          for (const q of boxes) {
            if (x > q[0]-R && x < q[3]+R && z > q[2]-R && z < q[5]+R &&
                q[1] < ty + 0.9 && q[4] > ty + 0.15) { blocked = true; break }
          }
          if (blocked) run = 0; else { run += 0.1; if (run > best) best = run }
        }
        if (best < 1.0) worst.push([+z.toFixed(1), +best.toFixed(2)])
      }
      return { label, tight: worst.length, worst: worst.slice(0, 12) }
    }
    const scanX = (x0, x1, z0, z1, label) => {          // corridor runs along x
      const worst = []
      for (let x = x0; x <= x1; x += 0.5) {
        let best = 0, run = 0
        for (let z = z0; z <= z1; z += 0.1) {
          const ty = api.terrainHeight(x, z)
          let blocked = false
          for (const q of boxes) {
            if (x > q[0]-R && x < q[3]+R && z > q[2]-R && z < q[5]+R &&
                q[1] < ty + 0.9 && q[4] > ty + 0.15) { blocked = true; break }
          }
          if (blocked) run = 0; else { run += 0.1; if (run > best) best = run }
        }
        if (best < 1.0) worst.push([+x.toFixed(1), +best.toFixed(2)])
      }
      return { label, tight: worst.length, worst: worst.slice(0, 12) }
    }
    return [
      scanZ(-15.5, 7.5, -55, 9, 'the square'),
      scanX(-30, -16.5, -34.5, -27.5, 'the sotoportego'),
      scanZ(-15.4, -12.6, -50, -8, 'the west loggia'),
      scanZ(4.6, 7.4, -50, -20, 'the east loggia'),
      scanZ(-30, 8, 6, 15, 'the Molo'),
    ]
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=wp.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
