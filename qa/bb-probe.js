async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('antarctic')
    for (let i=0;i<60;i++) g.tick(1/60,false)
    const res = { samples: [] }
    let ground = null
    g.scene.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh) return
      const gm = o.geometry
      if (!gm || !gm.attributes.color) return
      const n = gm.attributes.position.count
      if (n > 12000 && n < 30000 && !ground) ground = o
    })
    if (!ground) return { err: 'no ground' }
    const pos = ground.geometry.attributes.position
    const col = ground.geometry.attributes.color
    const want = [[24,92],[24,100],[34,92],[0,52],[122,30],[110,20]]
    for (const w of want) {
      let bi = -1, bd = 1e9
      for (let i = 0; i < pos.count; i++) {
        const dx = pos.getX(i)-w[0], dz = pos.getZ(i)-w[1]
        const d = dx*dx+dz*dz
        if (d < bd) { bd = d; bi = i }
      }
      res.samples.push({ at: w, c: [col.getX(bi).toFixed(3), col.getY(bi).toFixed(3), col.getZ(bi).toFixed(3)], y: pos.getY(bi).toFixed(2) })
    }
    res.count = pos.count
    return res
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=probe.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
