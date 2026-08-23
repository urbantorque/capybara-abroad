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
    await page.waitForTimeout(1500)
    out[n] = await page.evaluate((name) => {
      const g = window.__capy, api = g[name]
      const r = { locals: [], npc: [], notes: [] }
      // static boxes
      const boxes = []
      for (const b of g.world.bodies) {
        if (b.mass > 0 && b.type !== 4) continue
        let skip = false
        for (const sh of b.shapes) { const t = sh.constructor && sh.constructor.name; if (t==='Heightfield'||t==='Plane') skip = true }
        if (skip) continue
        for (let i = 0; i < b.shapes.length; i++) {
          const sh = b.shapes[i]
          if (!sh.halfExtents) continue
          const off = b.shapeOffsets[i], q = b.shapeOrientations[i]
          const p = new (b.position.constructor)(off.x, off.y, off.z)
          b.quaternion.vmult(p, p); p.vadd(b.position, p)
          boxes.push({ x:p.x, y:p.y, z:p.z, hx:sh.halfExtents.x, hy:sh.halfExtents.y, hz:sh.halfExtents.z })
        }
      }
      const inSolid = (x,y,z) => {
        for (const q of boxes) if (Math.abs(x-q.x)<q.hx && Math.abs(y-q.y)<q.hy && Math.abs(z-q.z)<q.hz) return true
        return false
      }
      for (const l of (g.locals||[])) {
        if (l.biome && l.biome !== name) continue
        const th = api.terrainHeight ? api.terrainHeight(l.x, l.z) : 0
        r.locals.push({ x:Math.round(l.x*10)/10, z:Math.round(l.z*10)/10,
          dy: Math.round((l.y - th)*100)/100,
          water: api.isOverWater ? !!api.isOverWater(l.x,l.z) : false,
          solid: inSolid(l.x, l.y+0.6, l.z),
          line: (l.lines&&l.lines[0]||'').slice(0,26) })
      }
      r.boxes = boxes.length
      return r
    }, n)
  }
  await page.evaluate((o) => fetch('/shot?name=k2probe.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1)))) }), out)
}
