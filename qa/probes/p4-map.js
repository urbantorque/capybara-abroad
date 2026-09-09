async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)
  await page.evaluate(() => { window.__capy.biome.switchTo('cali') })
  await page.waitForTimeout(1500)
  const out = await page.evaluate(() => {
    const g = window.__capy, api = g.cali
    const rows = []
    for (let z = 60; z >= -40; z -= 4) {
      let r = (z < 0 ? '' : ' ') + z + (Math.abs(z) < 10 ? ' ' : '') + '|'
      for (let x = -60; x <= 60; x += 4) {
        if (api.isOverWater(x, z)) { r += '~'; continue }
        r += api.navBlocked(x, z, 0.8) ? '#' : '.'
      }
      rows.push(r)
    }
    let hdr = '    |'
    for (let x = -60; x <= 60; x += 4) hdr += (x % 20 === 0 ? (x < 0 ? '-' : '+') : ' ')
    return { hdr, rows, river: api.waterLevel }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=p4map.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
