async page => {
  await page.reload(); await page.waitForTimeout(5500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('drift')
    for (let i=0;i<120;i++) g.tick(1/60,false)
    const b = g.capy.body
    const r = []
    for (const s of [{n:'crown',x:36,y:109,z:-184},{n:'spawn',x:2,y:31.6,z:42},{n:'arch',x:3,y:85,z:-103}]) {
      b.position.set(s.x,s.y,s.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<150;i++){ g.tick(1/60,false); b.position.set(s.x,s.y,s.z); b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }
      g.tick(1/60,true)
      const c = g.camera
      const d = new g.THREE.Vector3(); c.getWorldDirection(d)
      r.push({ n:s.n, cam:[+c.position.x.toFixed(1),+c.position.y.toFixed(1),+c.position.z.toFixed(1)],
               dir:[+d.x.toFixed(2),+d.y.toFixed(2),+d.z.toFixed(2)],
               capyGrpY: g.capy.group ? +g.capy.group.position.y.toFixed(1) : null,
               capyVis: g.capy.group ? g.capy.group.visible : null,
               terr: +g.drift.terrainHeight(s.x,s.z).toFixed(1),
               near: c.near, far: c.far, fov: c.fov,
               tris: g.renderer.info.render.triangles, calls: g.renderer.info.render.calls })
    }
    return r
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=L4.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
