async page => {
  await page.reload(); await page.waitForTimeout(5000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2000)
  await page.evaluate(() => { window.__capy.biome.switchTo('cali') })
  await page.waitForTimeout(1200)
  const out = await page.evaluate(() => {
    const g = window.__capy, c = g.cali
    const cx = -84, cz = -46, yaw = 1.068, D = 17.72
    const ax = Math.cos(yaw), az = -Math.sin(yaw)
    const ox = Math.sin(yaw), oz = Math.cos(yaw)
    const rows = []
    for (let along = -8; along <= 8; along += 4) {
      const r = []
      for (let outv = -6; outv <= 6; outv += 1) {
        const x = cx + ax * along + ox * outv, z = cz + az * along + oz * outv
        r.push(Math.round((c.terrainHeight(x, z) - D) * 100) / 100)
      }
      rows.push([along, r])
    }
    return { rows, note: 'terrain minus deck, out from -6 (inland) to +6 (valley)' }
  })
  await page.evaluate((o) => fetch('/shot?name=kcmir2.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
