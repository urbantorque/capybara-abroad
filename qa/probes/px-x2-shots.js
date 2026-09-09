async page => {
  const OUT = 'C:/Users/roger/OneDrive/Desktop/capy3/qa/'
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.reload({ timeout: 90000 })
  await page.waitForTimeout(6000)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)

  const SHOTS = [
    { ch: 'goreme', tag: 'valley', x: 0, z: 0 },
    { ch: 'goreme', tag: 'west-edge', x: -132, z: -20 },
    { ch: 'goreme', tag: 'south-edge', x: 10, z: -182 },
    { ch: 'cali', tag: 'north-edge', x: 0, z: 158 },
    { ch: 'kowloon', tag: 'north-edge', x: 0, z: 108 }
  ]
  let cur = null
  for (const s of SHOTS) {
    try {
      if (cur !== s.ch) {
        await page.evaluate((nm) => { const g = window.__capy; if (g.biome.current !== nm) g.biome.switchTo(nm) }, s.ch)
        await page.waitForTimeout(4500)
        cur = s.ch
      }
      await page.evaluate((t) => {
        const g = window.__capy
        const api = g.biome.current === 'sydney' ? g.env : g[g.biome.current]
        const h = api && api.terrainHeight ? api.terrainHeight(t.x, t.z) : 0
        const b = g.capy.body
        b.position.set(t.x, (h === h ? h : 0) + 0.6, t.z)
        b.velocity.set(0, 0, 0)
        b.previousPosition.copy(b.position)
        b.interpolatedPosition.copy(b.position)
      }, s)
      await page.waitForTimeout(2600)
      await page.screenshot({ path: OUT + 'px-x2-' + s.ch + '-' + s.tag + '.png', timeout: 20000 })
    } catch (e) { /* keep going */ }
  }
}
