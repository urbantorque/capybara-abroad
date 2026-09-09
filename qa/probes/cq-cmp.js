async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
  const out = {}
  for (const n of ['sydney','pasto','manly','venice','rio','kowloon','quay']) {
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<45;i++) g.tick(1/60,false)
      let tris = 0, meshes = 0, inst = 0
      g.scene.traverse(o => {
        for (let p = o; p; p = p.parent) if (!p.visible) return
        if (!o.isMesh && !o.isInstancedMesh) return
        const gm = o.geometry
        const t = gm && gm.index ? gm.index.count/3 : (gm && gm.attributes.position ? gm.attributes.position.count/3 : 0)
        const c = o.isInstancedMesh ? (o.count||0) : 1
        tris += t*c; meshes++; if (o.isInstancedMesh) inst += c
      })
      return { ktris: Math.round(tris/1000), meshes, inst, bodies: g.world.bodies.length }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=cq-cmp.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
