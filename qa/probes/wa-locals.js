async page => {
  await page.reload(); await page.waitForTimeout(5000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2000)
  const out = {}
  for (const n of ['venice','kowloon']) {
    out[n] = await page.evaluate((name) => {
      const g = window.__capy, THREE = g.THREE
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      for (let i=0;i<90;i++) g.tick(1/60,false)
      const api = g[name]
      const boxes = []
      for (const bd of g.world.bodies) {
        if (bd.mass > 0 && bd.type !== 4) continue
        let skip = false
        for (const sh of bd.shapes) { const t = sh.constructor && sh.constructor.name
          if (t === 'Heightfield' || t === 'Plane') skip = true }
        if (skip) continue
        bd.updateAABB()
        const lo = bd.aabb.lowerBound, hi = bd.aabb.upperBound
        if (!(lo.x === lo.x)) continue
        if ((hi.x-lo.x) > 90 || (hi.z-lo.z) > 90) continue
        boxes.push([lo.x, lo.y, lo.z, hi.x, hi.y, hi.z])
      }
      const res = []
      for (const r of (g.locals || [])) {
        if (r.biome && r.biome !== name) continue
        const p = r.group ? r.group.position : { x: r.x, y: r.y, z: r.z }
        const ty = api.terrainHeight ? api.terrainHeight(p.x, p.z) : 0
        const hit = boxes.filter(q => p.x > q[0] && p.x < q[3] && p.z > q[2] && p.z < q[5]
                                       && (ty + 1.0) > q[1] && (ty + 0.2) < q[4])
        const inside = hit.length ? hit[0].map(v=>+v.toFixed(1)) : false
        res.push({ x:+p.x.toFixed(1), z:+p.z.toFixed(1), y:+p.y.toFixed(2),
                   terr:+ty.toFixed(2), float:+(p.y-ty).toFixed(2), inside,
                   line: (r.lines && r.lines[0] || '').slice(0, 28) })
      }
      return res
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wa.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
