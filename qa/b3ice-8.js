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
  await page.waitForTimeout(12500)
  await page.screenshot({ path: 'qa/b3ice-normal.png' })
  // paint every curtain magenta at full opacity: if the sky does not go
  // magenta, the curtains are not reaching the framebuffer at all
  await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    window.__cur = []
    g.scene.traverse(o => {
      if (!o.isMesh || o.renderOrder !== -1) return
      if (!o.material || o.material.blending !== T.AdditiveBlending) return
      window.__cur.push(o)
      o.material.emissive.setHex(0xff00ff)
      o.material.opacity = 1
      o.material.depthTest = false
      o.material.needsUpdate = true
    })
    return window.__cur.length
  })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'qa/b3ice-magenta-nodepth.png' })
  await page.evaluate(() => {
    for (const o of window.__cur) { o.material.depthTest = true; o.material.needsUpdate = true }
  })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'qa/b3ice-magenta-depth.png' })
  const r = await page.evaluate(() => ({ n: window.__cur.length,
    aur: +window.__capy.iceland.aurora().toFixed(2) }))
  await page.evaluate(async o => {
    await fetch('/shot?name=b3ice8.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, r)
}
