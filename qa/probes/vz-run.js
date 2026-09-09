async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit0')
  await page.waitForTimeout(8000)
  await page.keyboard.down('KeyW')
  await page.keyboard.down('ShiftLeft')
  await page.waitForTimeout(3500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    return { biome: g.biome && g.biome.current, fov: Math.round(g.camera.fov * 10) / 10,
             pitchDeg: g.camInfo ? Math.round(g.camInfo.pitch * 1800 / Math.PI) / 10 : null,
             sp: g.capy && g.capy.body ? Math.round(Math.hypot(g.capy.body.velocity.x, g.capy.body.velocity.z) * 10) / 10 : null }
  })
  await page.evaluate(o => fetch('/shot?name=vz-info.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
  await page.waitForTimeout(300)
}
