async page => {
  await page.reload()
  await page.waitForTimeout(4500)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
  const names = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift','venice',
                 'kowloon','palawan','goreme','manly','pantanal','cave','antarctic']
  const rows = {}
  for (const n of names) {
    await page.evaluate((nm) => {
      const g = window.__capy
      if (g.biome.current !== nm) g.biome.switchTo(nm)
      const s = g.biome.spawnOf(nm)
      const b = g.capy.body
      b.position.set(s.x, s.y, s.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, n)
    await page.waitForTimeout(700)
    rows[n] = await page.evaluate(() => {
      const g = window.__capy
      const c = g.camera, p = g.capy.position
      const api = g.biome.current === 'sydney' ? g.env : g[g.biome.current]
      const th = (api && typeof api.terrainHeight === 'function') ? api.terrainHeight(c.position.x, c.position.z) : null
      return {
        relief: !!(api && typeof api.terrainHeight === 'function'),
        fov: +c.fov.toFixed(2),
        camY: +c.position.y.toFixed(2),
        capyY: +p.y.toFixed(2),
        groundUnderCam: th === null ? null : +th.toFixed(2),
        clear: th === null ? null : +(c.position.y - th).toFixed(2),
        err: g.state.lastError || null
      }
    })
  }
  const payload = JSON.stringify(rows)
  await page.evaluate(async (b) => {
    await fetch('/shot?name=gp-cam.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(b))) })
  }, payload)
}
