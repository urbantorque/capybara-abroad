async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1800)
  const ALL = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
               'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic']
  const out = {}
  for (const n of ALL) {
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
      let tris = 0, meshes = 0, shadowTris = 0
      const per = [], fam = {}
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        meshes++
        const gm = o.geometry; if (!gm) return
        const t = gm.index ? gm.index.count / 3 : (gm.attributes.position ? gm.attributes.position.count / 3 : 0)
        const tot = t * (o.isInstancedMesh ? o.count : 1)
        tris += tot
        if (o.castShadow) shadowTris += tot
        let nm = o.name || o.type, q = o.parent, guard = 0
        while (q && guard++ < 4) { if (q.name) nm = q.name + '/' + nm; q = q.parent }
        per.push([nm, Math.round(tot), o.isInstancedMesh ? o.count : 1, Math.round(t),
                  gm.type || '?'])
        // family = the name with any trailing :cN / index stripped, so a scatter
        // grid that emits one mesh per cell reports as ONE line and not as forty
        const key = (o.name || '(unnamed ' + (gm.type || '?') + ' ' + Math.round(t) + ')')
          .replace(/:c[-0-9]+$/, ':*').replace(/[0-9]+$/, '#')
        fam[key] = (fam[key] || 0) + tot
      })
      per.sort((a, b2) => b2[1] - a[1])
      const fams = Object.keys(fam).map(k => [k, Math.round(fam[k])])
        .sort((a, b2) => b2[1] - a[1]).slice(0, 12)
      return { tris: Math.round(tris), shadowTris: Math.round(shadowTris), meshes,
               bodies: g.world.bodies.length, top: per.slice(0, 14), fams,
               err: g.state.lastError || null }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=b4-tris.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
