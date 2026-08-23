async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('kowloon')
    const sp = g.biome.spawnOf('kowloon'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
    for (let i=0;i<600;i++) g.tick(1/60,false)
    let tris=0; g.scene.traverse(o=>{if(!(o.isMesh||o.isInstancedMesh))return;for(let p=o;p;p=p.parent)if(!p.visible)return;const gm=o.geometry;if(!gm)return;const n=gm.index?gm.index.count/3:(gm.attributes.position?gm.attributes.position.count/3:0);tris+=n*(o.isInstancedMesh?o.count:1)})
    return { err: g.state.lastError?String(g.state.lastError):'none', tris: Math.round(tris), bodies: g.world.bodies.length }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=hke.json', { method:'POST', body: btoa(JSON.stringify(o)) }) }, out)
}
