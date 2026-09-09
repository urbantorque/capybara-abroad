async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = {}
  for (const n of ['quay','kyoto','cali','pasto','sydney']) {
    await page.evaluate((name) => window.__capy.biome.switchTo(name), n)
    await page.waitForTimeout(900)
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      const api = g[name] || (name === 'sydney' ? g.env : null)
      const terr = (x,z) => { if (!api || typeof api.terrainHeight !== 'function') return 0
        const v = api.terrainHeight(x,z); return v===v?v:0 }
      const wet = (x,z) => api && typeof api.isOverWater === 'function' ? !!api.isOverWater(x,z) : false
      // is a point inside any static collider?
      const boxes = []
      for (const b of g.world.bodies) {
        if (b.mass > 0 && b.type !== 4) continue
        let skip=false
        for (const sh of b.shapes){const t=sh.constructor&&sh.constructor.name; if(t==='Heightfield'||t==='Plane')skip=true}
        if (skip) continue
        b.updateAABB(); const lo=b.aabb.lowerBound, hi=b.aabb.upperBound
        if(!(lo.x===lo.x))continue
        boxes.push([lo.x,lo.y,lo.z,hi.x,hi.y,hi.z])
      }
      const inBox=(x,y,z)=>{for(const q of boxes) if(x>q[0]&&x<q[3]&&y>q[1]&&y<q[4]&&z>q[2]&&z<q[5])return true; return false}
      return (g.locals||[]).filter(l => l.biome === name).map(l => ({
        at: [Math.round(l.x*10)/10, Math.round(l.y*100)/100, Math.round(l.z*10)/10],
        terr: Math.round(terr(l.x,l.z)*100)/100,
        gap: Math.round((l.y - terr(l.x,l.z))*100)/100,
        wet: wet(l.x,l.z),
        inside: inBox(l.x, l.y + 0.9, l.z),
        say: (l.lines && l.lines[0] || '').slice(0, 26),
      }))
    }, n)
  }
  await page.evaluate((o) => fetch('/shot?name=s2locals.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
