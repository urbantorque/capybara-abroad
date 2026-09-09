async page => {
  await page.reload()
  await page.waitForTimeout(4500)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
  const out = {}
  out.rest = await page.evaluate(() => ({ fov: +window.__capy.camera.fov.toFixed(2) }))
  // hold shift+W for two seconds and watch the lens
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW')
  await page.waitForTimeout(2200)
  out.running = await page.evaluate(() => {
    const g = window.__capy
    return { fov: +g.camera.fov.toFixed(2), sp: +Math.hypot(g.capy.velocity.x, g.capy.velocity.z).toFixed(2) }
  })
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft')
  await page.waitForTimeout(2500)
  out.stopped = await page.evaluate(() => ({ fov: +window.__capy.camera.fov.toFixed(2) }))
  // the punch: a full-magnitude event
  await page.evaluate(() => { window.__capy.punch(0.34) })
  await page.waitForTimeout(70)
  out.punched = await page.evaluate(() => ({ fov: +window.__capy.camera.fov.toFixed(2), ts: +window.__capy.state.timeScale.toFixed(3) }))
  await page.waitForTimeout(900)
  out.settled = await page.evaluate(() => ({ fov: +window.__capy.camera.fov.toFixed(2), ts: +window.__capy.state.timeScale.toFixed(3) }))
  // a medium event must NOT freeze
  await page.evaluate(() => { window.__capy.punch(0.09) })
  await page.waitForTimeout(50)
  out.mediumHit = await page.evaluate(() => ({ fov: +window.__capy.camera.fov.toFixed(2), ts: +window.__capy.state.timeScale.toFixed(3) }))
  await page.waitForTimeout(800)
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  const payload = JSON.stringify(out)
  await page.evaluate(async (b) => {
    await fetch('/shot?name=gp-fov.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(b))) })
  }, payload)
}
