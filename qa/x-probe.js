async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = {}
    g.biome.switchTo('antarctic')
    for (let i=0;i<200;i++) g.tick(1/60,false)
    const an = g.antarctic
    // petrels vs glacier
    const root = g.scene.getObjectByName('antarctic')
    R.rootFound = !!root
    // count pack lumps in a 120x120 box round the mid channel
    R.packInBox = 0
    // reach into globals is impossible; instead sample density
    R.ice = []
    for (const z of [0,-60,-120,-200,-300,-400]) {
      R.ice.push([z, +an.packAt(0,z).toFixed(2), +an.packAt(-80,z).toFixed(2), +an.packAt(80,z).toFixed(2)])
    }
    R.bodies = g.world.bodies.length
    // triangle count per mesh
    const tri = []
    root.traverse(o => {
      if (!o.isMesh) return
      const gm = o.geometry
      const n = gm.index ? gm.index.count/3 : gm.attributes.position.count/3
      const c = o.isInstancedMesh ? o.count : 1
      tri.push([o.name || o.type, Math.round(n*c), c])
    })
    tri.sort((a,b)=>b[1]-a[1])
    R.tris = tri.slice(0,14)
    R.total = tri.reduce((s,t)=>s+t[1],0)
    return R
  })

  await page.evaluate(async (o) => {
    await fetch('/shot?name=xprobe.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))})
  }, out)
}
