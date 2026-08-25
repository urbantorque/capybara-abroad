async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1800)
  const ALL = ['venice','cave','kowloon','kyoto','cali','manly','rio','palawan','sahara',
               'iceland','goreme','antarctic','pantanal']
  const out = {}
  for (const n of ALL) {
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
      let tris = 0, cast = 0
      const per = []
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        const gm = o.geometry; if (!gm) return
        const t = (gm.index ? gm.index.count / 3 : (gm.attributes.position ? gm.attributes.position.count / 3 : 0)) *
                  (o.isInstancedMesh ? o.count : 1)
        tris += t
        if (!o.castShadow) return
        cast += t
        const m = Array.isArray(o.material) ? o.material[0] : o.material
        // a bounding box, so a "what is this" question can be answered from the
        // report instead of from another run
        gm.computeBoundingBox()
        const bb = gm.boundingBox
        per.push([o.name || ('(' + (gm.type || '?') + ' ' + Math.round(t / (o.isInstancedMesh ? o.count : 1)) + ')'),
                  Math.round(t), o.isInstancedMesh ? o.count : 1,
                  [Math.round(bb.max.x - bb.min.x), Math.round(bb.max.y - bb.min.y),
                   Math.round(bb.max.z - bb.min.z)],
                  o.receiveShadow ? 'R' : '-', m && m.transparent ? 'T' : '-'])
      })
      per.sort((a, b2) => b2[1] - a[1])
      return { tris: Math.round(tris), cast: Math.round(cast),
               pct: Math.round(cast / tris * 100), top: per.slice(0, 10) }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=b4-cast.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
