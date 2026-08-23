async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(4000)
  await page.evaluate(async () => {
    const g = window.__capy
    const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                   'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                   'manly', 'pantanal', 'cave', 'antarctic']
    const MIN = 1.75
    const out = {}
    for (const n of names) {
      g.biome.switchTo(n)
      for (let i = 0; i < 10; i++) g.tick(1 / 60, false)
      const api = n === 'sydney' ? g.env : g[n]
      const waterY = (x, z) => {
        if (api && api.localWater === true && typeof api.waterHeightAt === 'function') {
          const y = api.waterHeightAt(x, z)
          if (typeof y === 'number' && y === y) return y
        }
        const w = api && api.waterLevel
        return (typeof w === 'number' && w === w) ? w : -0.5
      }
      const ground = (x, z) => {
        if (!api || typeof api.terrainHeight !== 'function') return 0
        const v = api.terrainHeight(x, z)
        return (typeof v === 'number' && v === v) ? v : 0
      }
      let wet = 0, divable = 0, maxD = -99, sum = 0
      const R = 200
      for (let x = -R; x <= R; x += 8) {
        for (let z = -R; z <= R; z += 8) {
          const over = api && typeof api.isOverWater === 'function' ? api.isOverWater(x, z) : false
          if (!over) continue
          wet++
          const d = waterY(x, z) - ground(x, z)
          if (d > maxD) maxD = d
          sum += d
          if (d >= MIN) divable++
        }
      }
      out[n] = {
        flag: api ? (api.canDive === true ? 'true' : api.canDive === false ? 'false' : '-') : 'no api',
        wetCells: wet,
        divableCells: divable,
        pct: wet ? Math.round(divable / wet * 100) : 0,
        maxDepth: wet ? Number(maxD.toFixed(2)) : null,
        meanDepth: wet ? Number((sum / wet).toFixed(2)) : null,
      }
    }
    await fetch('/shot?name=v19depth.json', {
      method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(out, null, 1)))),
    })
  })
  return 'ok'
}
