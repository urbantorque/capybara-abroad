async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('iceland')
    const b = g.capy.body
    b.position.set(-40, 1.2, -10)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    b.velocity.set(0, 0, 0)
    g.input.x = 0; g.input.z = 0
  })
  await page.waitForTimeout(1500)
  // swing the camera round with the Z key so the moment is entered from a
  // yaw the chapter did not choose
  await page.keyboard.down('KeyZ')
  await page.waitForTimeout(1600)
  await page.keyboard.up('KeyZ')
  await page.waitForTimeout(9500)
  await page.screenshot({ path: 'qa/b3ice-ignition-a.png' })
  const a = await page.evaluate(() => {
    const g = window.__capy, I = g.iceland
    return { aur: +I.aurora().toFixed(2), sky: +I.skyward().toFixed(2),
             yaw: +(Math.atan2(g.camera.position.x - g.capy.position.x,
                               g.camera.position.z - g.capy.position.z) * 57.2958).toFixed(0),
             pitch: +(Math.atan2(g.camera.position.y - g.capy.position.y,
               Math.hypot(g.camera.position.x - g.capy.position.x,
                          g.camera.position.z - g.capy.position.z)) * 57.2958).toFixed(1),
             dist: +Math.hypot(g.camera.position.x - g.capy.position.x,
                               g.camera.position.z - g.capy.position.z).toFixed(1) }
  })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'qa/b3ice-ignition-b.png' })
  // and after the ignition drops to 0.55
  await page.waitForTimeout(9000)
  await page.screenshot({ path: 'qa/b3ice-after.png' })
  const b2 = await page.evaluate(() => {
    const g = window.__capy, I = g.iceland
    return { aur: +I.aurora().toFixed(2), sky: +I.skyward().toFixed(2),
             pitch: +(Math.atan2(g.camera.position.y - g.capy.position.y,
               Math.hypot(g.camera.position.x - g.capy.position.x,
                          g.camera.position.z - g.capy.position.z)) * 57.2958).toFixed(1),
             loaf: +g.capy.loaf.toFixed(2), soak: +I.soak().toFixed(2) }
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=b3ice4.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, { a, b2 })
}
