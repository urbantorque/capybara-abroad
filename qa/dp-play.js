async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(1400)
  await page.keyboard.up('KeyW')
  await page.keyboard.press('Space')
  await page.waitForTimeout(900)
  await page.keyboard.press('KeyQ')
  await page.waitForTimeout(1600)
  await page.evaluate(async () => {
    const c = document.querySelector('canvas')
    const d = c.toDataURL('image/png')
    await fetch('/shot?name=dp-sydney', { method: 'POST', body: d })
  })
  await page.evaluate(async () => {
    const g = window.__capy
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    g.biome.switchTo('manly')
    const s = g.biome.spawnOf('manly'), b = g.capy.body
    b.position.set(s.x, s.y, s.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    await sleep(2500)
  })
  await page.waitForTimeout(1500)
  await page.evaluate(async () => {
    const c = document.querySelector('canvas')
    await fetch('/shot?name=dp-manly', { method: 'POST', body: c.toDataURL('image/png') })
  })
  const st = await page.evaluate(() => ({
    err: window.__capy.state.lastError ? String(window.__capy.state.lastError) : null,
    biome: window.__capy.biome.current,
    fps: Math.round(1 / Math.max(0.001, window.__capy.state.dt)),
  }))
  await page.evaluate(async o => {
    await fetch('/shot?name=dpplay.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, st)
}
