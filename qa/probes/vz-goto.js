async page => {
  const KEY = 'Digit0'
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press(KEY)
  await page.waitForTimeout(8000)
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(1800)
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(2800)
  const out = await page.evaluate(() => {
    const g = window.__capy
    return { biome: g.biome && g.biome.current, fov: Math.round(g.camera.fov * 10) / 10,
             pitchDeg: g.camInfo ? Math.round(g.camInfo.pitch * 1800 / Math.PI) / 10 : null,
             reach: g.camInfo ? Math.round(g.camInfo.reach * 10) / 10 : null,
             err: g.state && g.state.lastError }
  })
  await page.evaluate(o => fetch('/shot?name=vz-info.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
  await page.waitForTimeout(500)
}
