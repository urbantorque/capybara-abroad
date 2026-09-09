async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const names = ['palawan','goreme','manly','pasto','venice']
  const out = {}
  for (const n of names) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, n)
    await page.waitForTimeout(1200)
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      let tris = 0, meshes = 0, inst = 0, glow = 0, transp = 0
      const byName = {}
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        meshes++
        const gm = o.geometry
        if (!gm) return
        let t = gm.index ? gm.index.count/3 : (gm.attributes.position ? gm.attributes.position.count/3 : 0)
        if (o.isInstancedMesh) { t *= o.count; inst++ }
        tris += t
        const m = Array.isArray(o.material)?o.material[0]:o.material
        if (m && m.transparent) transp++
        if (m && (m.emissiveIntensity>0.01 || m.isMeshBasicMaterial)) glow++
        let nm = o.name||'', q=o.parent, guard=0
        while (q && guard++<5) { if (q.name) nm = nm?(q.name+'/'+nm):q.name; q=q.parent }
        nm = nm || o.type
        byName[nm] = (byName[nm]||0) + Math.round(t)
      })
      const top = Object.entries(byName).sort((a,b)=>b[1]-a[1]).slice(0,14)
      const npcs = (g.npcs||[]).filter(r => r.biome === name || !r.biome)
      const kinds = {}
      for (const r of (g.npcs||[])) { const k = (r.biome||'?')+':'+(r.kind||'?'); kinds[k]=(kinds[k]||0)+1 }
      let bodies = 0
      for (const b of g.world.bodies) bodies++
      const api = g[name] || {}
      return { tris: Math.round(tris), meshes, inst, glow, transp, bodies,
               npcAll: (g.npcs||[]).length, kinds, top,
               apiKeys: Object.keys(api), props: (g.props||[]).length }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=p4base.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
