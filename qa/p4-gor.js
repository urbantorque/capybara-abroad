async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('goreme')
    const sp = g.biome.spawnOf('goreme'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    await new Promise(r => setTimeout(r, 1800))
    let tris=0, meshes=0
    g.scene.traverse(o => { if(!o.isMesh&&!o.isInstancedMesh) return
      for(let p=o;p;p=p.parent) if(!p.visible) return
      meshes++; const gm=o.geometry; if(!gm) return
      let t = gm.index?gm.index.count/3:(gm.attributes.position?gm.attributes.position.count/3:0)
      if(o.isInstancedMesh) t*=o.count; tris+=t })
    return { tris: Math.round(tris), meshes, bodies: g.world.bodies.length, err: g.state.lastError || null }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=p4gor.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
