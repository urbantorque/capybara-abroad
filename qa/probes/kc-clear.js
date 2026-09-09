async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => { window.__capy.biome.switchTo('cali') })
  await page.waitForTimeout(1500)
  const out = await page.evaluate(() => {
    const g = window.__capy, c = g.cali, THREE = g.THREE, CV = g.capy.body.position.constructor
    const boxes = []
    for (const b of g.world.bodies) {
      if (b.mass > 0) continue
      if (b.type === 4) continue                       // KINEMATIC: that is the bus
      let skip = false
      for (const sh of b.shapes) { const t = sh.constructor && sh.constructor.name; if (t==='Heightfield'||t==='Plane') skip = true }
      if (skip) continue
      for (let i = 0; i < b.shapes.length; i++) {
        const sh = b.shapes[i]; if (!sh.halfExtents) continue
        const off = b.shapeOffsets[i]
        const p = new CV(off.x, off.y, off.z); b.quaternion.vmult(p,p); p.vadd(b.position,p)
        boxes.push({x:p.x,y:p.y,z:p.z,hx:sh.halfExtents.x,hy:sh.halfExtents.y,hz:sh.halfExtents.z})
      }
    }
    // walk the route by driving chivaAt through a scripted ride is slow; instead
    // read the road ribbon's own samples off the drawn mesh is fragile, so use
    // the bus: reset her, step, and log where she is
    const road = []
    { const b = g.capy.body
      const a0 = c.chivaAt(); b.position.set(a0.x, a0.y + 4.2, a0.z)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 9000; i++) {
        const a = c.chivaAt()
        if (c.chivaState() !== 'arrived') {
          b.position.set(a.x, a.y + 4.05, a.z); b.velocity.set(a.v*Math.sin(a.yaw),0,a.v*Math.cos(a.yaw))
          b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
        }
        g.tick(1/60, false)
        const p = c.chivaAt()
        if (i % 5 === 0) road.push([p.x, p.y, p.z])
        if (c.chivaState() === 'arrived') break
      }
    }
    // anything solid inside the bus's swept box?
    const foul = []
    for (const r of road) {
      for (const q of boxes) {
        if (Math.abs(r[0]-q.x) > q.hx + 1.8 || Math.abs(r[2]-q.z) > q.hz + 1.8) continue
        if (r[1] + 4.0 < q.y - q.hy || r[1] + 0.2 > q.y + q.hy) continue
        foul.push([Math.round(r[0]), Math.round(r[2]),
                   Math.round(q.x), Math.round(q.y*10)/10, Math.round(q.z),
                   Math.round(q.hx*10)/10, Math.round(q.hy*10)/10, Math.round(q.hz*10)/10])
        break
      }
    }
    // and: is anything DRAWN standing over the river?
    const overWater = []
    g.scene.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh) return
      if (!o.geometry || !o.geometry.boundingBox) o.geometry && o.geometry.computeBoundingBox()
    })
    return { road: road.length, boxes: boxes.length,
             foul: foul.slice(0, 12), foulN: foul.length, overWater }
  })
  await page.evaluate((o) => fetch('/shot?name=kcclear.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
