async page => {
  const KEY = 'Digit0'
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press(KEY)
  await page.waitForTimeout(8000)
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(1800)
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(7000)
  const out = await page.evaluate(() => {
    const g = window.__capy, c = g.camInfo
    return { biome: g.biome && g.biome.current, fov: Math.round(g.camera.fov * 10) / 10,
             pitchDeg: Math.round(c.pitch * 1800 / Math.PI) / 10,
             reach: Math.round(c.reach * 10) / 10, rest: Math.round(c.rest * 100) / 100,
             sky: Math.round(c.sky * 100) / 100, clear: Math.round(c.clear * 100) / 100,
             lift2: Math.round(c.lift2 * 100) / 100,
             camY: Math.round(g.camera.position.y * 10) / 10,
             err: g.state && g.state.lastError }
  })
  await page.evaluate(o => fetch('/shot?name=vz-info.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
  await page.waitForTimeout(400)
}
