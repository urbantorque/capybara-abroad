async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy, CANNON = g.CANNON
    g.biome.switchTo('kowloon')
    for (let i=0;i<60;i++) g.tick(1/60,false)
    const res = new CANNON.RaycastResult()
    const rows = []
    for (const [x0,y0,z0,x1] of [[8,0.5,42,10.4],[8,1.2,42,10.4],[8,2.0,42,10.4],[-6,0.6,48,-3.6],[8,0.5,-30,10.4]]) {
      res.reset()
      g.world.raycastClosest(new CANNON.Vec3(x0,y0,z0), new CANNON.Vec3(x1,y0,z0), {skipBackfaces:false}, res)
      rows.push({ from:[x0,y0,z0], to:x1, hit:res.hasHit, at: res.hasHit ? [+res.hitPointWorld.x.toFixed(2)] : null,
                  shapes: res.body ? res.body.shapes.length : 0 })
    }
    // and what the compound bodies actually are
    const bods = g.world.bodies.filter(b => b.shapes.length > 3).map(b => ({ n: b.shapes.length, p:[+b.position.x.toFixed(1),+b.position.y.toFixed(1),+b.position.z.toFixed(1)],
      aabb: (b.updateAABB(), [Math.round(b.aabb.lowerBound.x),Math.round(b.aabb.lowerBound.y),Math.round(b.aabb.lowerBound.z),Math.round(b.aabb.upperBound.x),Math.round(b.aabb.upperBound.y),Math.round(b.aabb.upperBound.z)]) }))
    return { rows, bods }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=t4ray.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
