async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)
  await page.evaluate(() => { window.__capy.biome.switchTo('kyoto') })
  await page.waitForTimeout(1500)
  const out = await page.evaluate(() => {
    const g = window.__capy, api = g.kyoto
    const rows = []
    for (let z = 76; z >= 0; z -= 3) {
      let r = (z + '   ').slice(0, 3) + '|'
      for (let x = -60; x <= 60; x += 3) {
        if (api.isOverWater(x, z)) { r += '~'; continue }
        r += api.navBlocked(x, z, 0.8) ? '#' : '.'
      }
      rows.push(r)
    }
    return { rows, gion: 52 }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=p4kmap.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
