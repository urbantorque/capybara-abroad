async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = {}
  for (const n of ['kyoto','cali']) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, n)
    await page.waitForTimeout(1200)
    out[n] = await page.evaluate((name) => {
      const g = window.__capy, api = g[name], CV = g.capy.body.position.constructor
      const boxes = []
      for (const b of g.world.bodies) {
        if (b.mass > 0 && b.type !== 4) continue
        let skip = false
        for (const sh of b.shapes) { const t = sh.constructor && sh.constructor.name; if (t==='Heightfield'||t==='Plane') skip = true }
        if (skip) continue
        for (let i = 0; i < b.shapes.length; i++) {
          const sh = b.shapes[i]
          if (!sh.halfExtents) continue
          const off = b.shapeOffsets[i]
          const p = new CV(off.x, off.y, off.z)
          b.quaternion.vmult(p, p); p.vadd(b.position, p)
          boxes.push({ x:p.x, y:p.y, z:p.z, hx:sh.halfExtents.x, hy:sh.halfExtents.y, hz:sh.halfExtents.z })
        }
      }
      const hit = (x,y,z) => {
        for (const q of boxes) if (Math.abs(x-q.x)<q.hx && Math.abs(y-q.y)<q.hy && Math.abs(z-q.z)<q.hz)
          return [Math.round(q.x),Math.round(q.y),Math.round(q.z),Math.round(q.hx*10)/10,Math.round(q.hy*10)/10,Math.round(q.hz*10)/10]
        return null
      }
      const r = { boxes: boxes.length, air: hit(0, 200, 0), locals: [] }
      for (const l of (g.locals||[])) {
        if (l.biome && l.biome !== name) continue
        const th = api.terrainHeight ? api.terrainHeight(l.x, l.z) : 0
        r.locals.push({ p:[Math.round(l.x*10)/10, Math.round(l.z*10)/10], dy: Math.round((l.y-th)*100)/100,
          water: api.isOverWater ? !!api.isOverWater(l.x,l.z) : false,
          in: hit(l.x, l.y+0.6, l.z), who: (l.lines&&l.lines[0]||'').slice(0,20) })
      }
      return r
    }, n)
  }
  await page.evaluate((o) => fetch('/shot?name=k3solid.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1)))) }), out)
}
