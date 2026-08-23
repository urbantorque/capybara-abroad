async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('sahara')
    const b = g.capy.body
    // out in the erg, and drive the storm clock all the way to the wall
    b.position.set(240, 30, 10); b.velocity.set(0,0,0)
    for (let i=0;i<90;i++) g.tick(1/60,false)
    const count = () => { let t=0,m=0; g.scene.traverse(o=>{ if(!o.isMesh&&!o.isInstancedMesh)return
      for(let p=o;p;p=p.parent) if(!p.visible) return
      m++; const gm=o.geometry; if(!gm) return
      const q = gm.index? gm.index.count/3 : (gm.attributes.position? gm.attributes.position.count/3:0)
      t += q*(o.isInstancedMesh?o.count:1) }); return [Math.round(t), m] }
    const base = count()
    // 22 s of erg arms the warning; then 7 s of build is the wall at full size
    for (let i=0;i<60*32;i++) { g.tick(1/60,false); b.position.set(240,30,10); b.velocity.set(0,0,0) }
    const build = count()
    for (let i=0;i<60*22;i++) { g.tick(1/60,false); b.position.set(240,30,10); b.velocity.set(0,0,0) }
    const hold = count()
    for (let i=0;i<60*40;i++) { g.tick(1/60,false); b.position.set(240,30,10); b.velocity.set(0,0,0) }
    const dusk = count()
    return { base, build, hold, dusk, phase: g.sahara.storm(), duskv: g.sahara.dusk(),
             bodies: g.world.bodies.length, err: g.state.lastError || null }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=z8peak.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
