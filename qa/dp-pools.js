async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const list = b => {
      const r = []
      for (const o of g.scene.children) {
        if (!o.isInstancedMesh) continue
        r.push({ c: o.count, geo: o.geometry.type, vis: o.visible })
      }
      return r
    }
    const R = { sydney: null, kyoto: null }
    R.sydney = list()
    g.biome.switchTo('kyoto')
    const s = g.biome.spawnOf('kyoto'), b = g.capy.body
    b.position.set(s.x, s.y, s.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 60; i++) g.tick(1/60, false)
    R.kyoto = list()
    return R
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=dppools.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
