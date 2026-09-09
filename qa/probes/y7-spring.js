async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('iceland')
    const b = g.capy.body
    b.position.set(-40, 1, -10); b.velocity.set(0,0,0)
    for (let i=0;i<200;i++) g.tick(1/60,false)
    const api = g.iceland
    const rows = []
    for (let d = 0; d <= 12; d += 1.5) {
      rows.push([d, Math.round(api.terrainHeight(-40 + d, -10)*100)/100,
                 Math.round(api.waterHeightAt(-40 + d, -10)*100)/100,
                 api.isOverWater(-40 + d, -10)])
    }
    return { rows, capyY: Math.round(g.capy.position.y*100)/100, wet: g.capy.wet }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=y7spring.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
