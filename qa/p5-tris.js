async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(() => { const g = window.__capy; g.biome.switchTo('pantanal') })
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy, rows = []
    g.scene.traverse(o => {
      if (!o.isMesh && !o.isInstancedMesh) return
      for (let p = o; p; p = p.parent) if (!p.visible) return
      const gm = o.geometry
      const t = gm && gm.index ? gm.index.count/3 : (gm && gm.attributes.position ? gm.attributes.position.count/3 : 0)
      const n = o.isInstancedMesh ? (o.count||0) : 1
      const bb = gm ? (gm.boundingBox || (gm.computeBoundingBox(), gm.boundingBox)) : null
      rows.push([Math.round(t*n), Math.round(t), n, o.isInstancedMesh?'inst':'mesh',
        bb ? [+bb.min.x.toFixed(1),+bb.max.x.toFixed(1)].join('..') : ''])
    })
    rows.sort((a,b)=>b[0]-a[0])
    return rows.slice(0, 16)
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=p5tris.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
