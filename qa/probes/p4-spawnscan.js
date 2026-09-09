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
      const rows = []
      // candidates on a coarse grid round the current spawn
      for (let x = S.x - 30; x <= S.x + 30; x += 6) {
        for (let z = S.z - 30; z <= S.z + 30; z += 4) {
          if (api.navBlocked(x, z, 1.0)) continue
          if (api.isOverWater && api.isOverWater(x, z)) continue
          const y = api.terrainHeight(x, z)
          // how open is it: min clear run over 12 compass points
          let minRun = 99, openN = 0
          for (let a = 0; a < 12; a++) {
            const th = a * Math.PI / 6
            let d = 0
            for (; d < 26; d += 1) if (api.navBlocked(x + Math.sin(th) * d, z + Math.cos(th) * d, 0.6)) break
            if (d < minRun) minRun = d
            if (d >= 12) openN++
          }
          rows.push([x, z, +y.toFixed(1), minRun, openN])
        }
      }
      rows.sort((a, b) => b[4] - a[4] || b[3] - a[3])
      return { spawn: [S.x, S.z], top: rows.slice(0, 14) }
    })
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=p4scan.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
