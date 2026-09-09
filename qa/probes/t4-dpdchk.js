async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy, CANNON = g.CANNON
    g.biome.switchTo('kowloon')
    for (let i=0;i<60;i++) g.tick(1/60,false)
    const res = new CANNON.RaycastResult()
    const rows = []
    for (let z = -34; z <= -14; z += 2) {
      // sweep across the pavement at capybara height and find the free span
      const free = []
      for (let x = 6.0; x <= 10.0; x += 0.25) {
        res.reset()
        g.world.raycastClosest(new CANNON.Vec3(x, 0.45, z - 0.6), new CANNON.Vec3(x, 0.45, z + 0.6), {skipBackfaces:false}, res)
        let blocked = res.hasHit
        if (!blocked) {
          res.reset()
          g.world.raycastClosest(new CANNON.Vec3(x - 0.6, 0.45, z), new CANNON.Vec3(x + 0.6, 0.45, z), {skipBackfaces:false}, res)
          blocked = res.hasHit
        }
        if (!blocked) free.push(+x.toFixed(2))
      }
      rows.push({ z, free: free.length ? free[0] + '..' + free[free.length-1] + ' (' + free.length + ')' : 'NONE' })
    }
    // where is the dai pai dong body?
    const bodies = g.world.bodies.filter(b => { b.updateAABB(); return b.aabb.lowerBound.z > -32 && b.aabb.upperBound.z < -14 && b.aabb.upperBound.x > 3 })
      .map(b => ({ n: b.shapes.length, aabb: [b.aabb.lowerBound.x, b.aabb.lowerBound.z, b.aabb.upperBound.x, b.aabb.upperBound.z].map(v=>+v.toFixed(1)) }))
    return { rows, bodies }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=t4dpd.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
