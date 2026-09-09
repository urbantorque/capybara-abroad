async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)
  const out = {}
  for (const bio of ['kyoto','cali','rio']) {
    await page.evaluate((b) => { const g = window.__capy; g.biome.switchTo(b) }, bio)
    await page.waitForTimeout(1500)
    out[bio] = await page.evaluate(() => {
      const g = window.__capy, api = g[g.biome.current]
      const S = api.SPAWN
      const grid = []
      for (let dz = -14; dz <= 14; dz += 2) {
        let row = ''
        for (let dx = -14; dx <= 14; dx += 2) {
          row += api.navBlocked(S.x + dx, S.z + dz, 0.55) ? '#' : '.'
        }
        grid.push(row)
      }
      // nearest clear sight line: how far can you see in each of 8 directions
      const rays = []
      for (let a = 0; a < 8; a++) {
        const th = a * Math.PI / 4
        let d = 0
        for (; d < 60; d += 1) { if (api.navBlocked(S.x + Math.sin(th) * d, S.z + Math.cos(th) * d, 0.5)) break }
        rays.push(d)
      }
      return { spawn: [S.x, S.z], blockedAtSpawn: api.navBlocked(S.x, S.z, 0.6), grid, rays }
    })
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=p4spawn.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
