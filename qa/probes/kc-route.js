async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => { window.__capy.biome.switchTo('cali') })
  await page.waitForTimeout(1500)
  const out = await page.evaluate(() => {
    const g = window.__capy, c = g.cali, CV = g.capy.body.position.constructor
    const boxes = []
    for (const b of g.world.bodies) {
      if (b.mass > 0 && b.type !== 4) continue
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
    // the chiva is 2.9 wide and 3.7 tall; sample the route and look for anything
    // solid inside the swept box
    const hits = []
    const L = c.routeLength ? c.routeLength() : null
    const at = c.chivaRouteAt || null
    const samples = []
    // reach the route through the published api if there is one; otherwise walk
    // the drawn road by sampling the bus's own path via caliRouteAt is private,
    // so use the wire list + stops as the best public proxy
    const probe = (x, z, y) => {
      for (const q of boxes) {
        if (Math.abs(x-q.x) < q.hx + 1.6 && Math.abs(z-q.z) < q.hz + 1.6 &&
            y > q.y - q.hy && y < q.y + q.hy + 3.4) return q
      }
      return null
    }
    return { boxes: boxes.length, L, hasAt: !!at,
      api: Object.keys(c).slice(0, 40), hits, samples }
  })
  await page.evaluate((o) => fetch('/shot?name=kcroute.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
