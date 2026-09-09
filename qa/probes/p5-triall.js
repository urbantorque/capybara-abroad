async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const names = ['sydney','quay','pasto','kyoto','cali','rio','iceland','sahara','drift',
                 'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic']
  const out = {}
  for (const n of names) {
    out[n] = await page.evaluate(async (name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      await new Promise(r => setTimeout(r, 2200))
      let tris = 0, meshes = 0, inst = 0, instTris = 0
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        const gm = o.geometry
        const t = gm && gm.index ? gm.index.count / 3
                : (gm && gm.attributes.position ? gm.attributes.position.count / 3 : 0)
        const n2 = o.isInstancedMesh ? (o.count || 0) : 1
        tris += t * n2
        if (o.isInstancedMesh) { inst++; instTris += t * n2 } else meshes++
      })
      return { tris: Math.round(tris), instTris: Math.round(instTris),
               meshes: meshes, inst: inst, bodies: g.world.bodies.length }
    }, n)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=p5triall.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
