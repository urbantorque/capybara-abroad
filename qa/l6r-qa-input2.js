async page => {
  const out = {}
  const cam = (label) => page.evaluate((label) => {
    const g = window.__capy
    const c = g.camera.position, p = g.capy.position
    const dx = c.x - p.x, dy = c.y - p.y, dz = c.z - p.z
    const horiz = Math.hypot(dx, dz)
    return { label, pitchDeg: +(Math.atan2(dy, horiz) * 180 / Math.PI).toFixed(1), dist: +Math.hypot(dx, dy, dz).toFixed(1),
      bare: document.querySelector('.capyui-root, [class*="capyui"]') ? !!document.querySelector('.bare') : null, time: +g.state.time.toFixed(1) }
  }, label)
  out.a = await cam('afterProbe1')
  await page.keyboard.press('KeyP'); await page.waitForTimeout(500)
  await page.keyboard.press('KeyC'); await page.waitForTimeout(3000)
  out.b = await cam('afterC')
  // walk a bit to let the lens settle
  await page.keyboard.down('KeyW'); await page.waitForTimeout(3000); await page.keyboard.up('KeyW'); await page.waitForTimeout(3000)
  out.c = await cam('afterWalk')
  await page.screenshot({ path: 'qa/l6r-qa-input2-1280.png' })
  await page.setViewportSize({ width: 800, height: 500 }); await page.waitForTimeout(2500)
  await page.screenshot({ path: 'qa/l6r-qa-input2-800x500.png' })
  await page.setViewportSize({ width: 1920, height: 1080 }); await page.waitForTimeout(2500)
  await page.screenshot({ path: 'qa/l6r-qa-input2-1920x1080.png' })
  await page.setViewportSize({ width: 1280, height: 720 }); await page.waitForTimeout(1500)
  // V held 2 s then released: does the eye come back?
  out.v0 = await cam('beforeV')
  await page.keyboard.down('KeyV'); await page.waitForTimeout(2000)
  out.v1 = await cam('Vheld')
  await page.keyboard.up('KeyV'); await page.waitForTimeout(4000)
  out.v2 = await cam('Vreleased4s')
  // X held 2 s then released
  await page.keyboard.down('KeyX'); await page.waitForTimeout(2000); await page.keyboard.up('KeyX'); await page.waitForTimeout(3000)
  out.x = await cam('afterX')
  await page.screenshot({ path: 'qa/l6r-qa-input2-afterVX.png' })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6r-qa-input2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
