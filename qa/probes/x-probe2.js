async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = {}
    const count = (name) => {
      const root = g.scene.getObjectByName(name)
      if (!root) return null
      let total = 0, meshes = 0
      const tri = []
      root.traverse(o => {
        if (!o.isMesh) return
        const gm = o.geometry
        const n = gm.index ? gm.index.count/3 : gm.attributes.position.count/3
        const c = o.isInstancedMesh ? o.count : 1
        tri.push([Math.round(n*c), c])
        total += n*c; meshes++
      })
      tri.sort((a,b)=>b[0]-a[0])
      return { total: Math.round(total), meshes, top: tri.slice(0,10) }
    }
    for (const b of ['pantanal','cave','antarctic']) {
      g.biome.switchTo(b)
      for (let i=0;i<120;i++) g.tick(1/60,false)
      R[b] = count(b)
      R[b+'_bodies'] = g.world.bodies.length
    }
    return R
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=xprobe2.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))})
  }, out)
}
