async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(() => {
    const g = window.__capy
    g.state.lastError = null
    g.biome.switchTo('pantanal')
    const sp = g.biome.spawnOf('pantanal'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
  })
  await page.waitForTimeout(6000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    let tris = 0
    g.scene.traverse(o => {
      if (!o.isMesh && !o.isInstancedMesh) return
      for (let p = o; p; p = p.parent) if (!p.visible) return
      const gm = o.geometry
      const t = gm && gm.index ? gm.index.count/3 : (gm && gm.attributes.position ? gm.attributes.position.count/3 : 0)
      tris += t * (o.isInstancedMesh ? (o.count||0) : 1)
    })
    return { tris: Math.round(tris), bodies: g.world.bodies.length,
             locals: (g.locals||[]).filter(l=>l.biome==='pantanal').length,
             dusk: g.pantanal.dusk(), err: g.state.lastError||null }
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=p5pan.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1)))) })
  }, out)
}
