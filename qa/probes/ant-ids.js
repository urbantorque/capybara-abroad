async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1500)
  const out = {}
  for (const [biome, ids] of [['sydney', [44]], ['pasto', [952, 956, 958, 959, 980]], ['quay', [896, 898, 900, 921]]]) {
    await page.evaluate((b) => { window.__capy.biome.switchTo(b) }, biome)
    await page.waitForTimeout(1200)
    out[biome] = await page.evaluate((list) => {
      const g = window.__capy
      const r = []
      for (const id of list) {
        const o = g.scene.getObjectById(id)
        if (!o) { r.push([id, 'MISSING']); continue }
        const chain = []
        let q = o
        while (q) { chain.push(q.name || q.type); q = q.parent }
        o.geometry && o.geometry.computeBoundingBox()
        const bb = o.geometry ? o.geometry.boundingBox : null
        r.push([id, chain.join(' < '),
                o.isInstancedMesh ? ('inst x' + o.count) : 'mesh',
                bb ? [Math.round(bb.min.x), Math.round(bb.min.y), Math.round(bb.min.z),
                      Math.round(bb.max.x), Math.round(bb.max.y), Math.round(bb.max.z)] : null,
                o.material && o.material.color ? '#' + o.material.color.getHexString() : ''])
      }
      return r
    }, ids)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=antids.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
