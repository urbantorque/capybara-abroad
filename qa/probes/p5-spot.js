async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('pantanal')
    const T = g.pantanal.terrainHeight
    const rows = []
    for (let x = -60; x <= -30; x += 4) for (let z = -52; z <= -34; z += 3) {
      rows.push([x, z, +T(x, z).toFixed(2)])
    }
    return rows.filter(r => r[2] > 0.55)
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=p5spot.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
