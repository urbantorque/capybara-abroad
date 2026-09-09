async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(6000)
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(2500)
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    return { biome: g.biome && g.biome.current, started: g.state && g.state.started,
             err: g.state && g.state.lastError,
             cam: g.camInfo ? JSON.parse(JSON.stringify(g.camInfo)) : null,
             fov: g.camera.fov }
  })
  await page.evaluate(o => fetch('/shot?name=vz-info.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
  await page.waitForTimeout(600)
}
