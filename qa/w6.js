async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo(window.__QB||'venice')
    const sp = g.biome.spawnOf('venice'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
    for (let i=0;i<60;i++) g.tick(1/60,false)
    let tris=0
    g.scene.traverse(o => { if(!o.isMesh&&!o.isInstancedMesh)return
      for(let p=o;p;p=p.parent) if(!p.visible)return
      const gm=o.geometry; if(!gm)return
      const t=gm.index?gm.index.count/3:(gm.attributes.position?gm.attributes.position.count/3:0)
      tris+=t*(o.isInstancedMesh?o.count:1) })
    g.tick(1/60,true)
    const t0=performance.now(); for(let i=0;i<30;i++) g.tick(1/60,true)
    return { tris: Math.round(tris), ft: +((performance.now()-t0)/30).toFixed(2), bodies: g.world.bodies.length, err: g.state.lastError||null }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=w6.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
