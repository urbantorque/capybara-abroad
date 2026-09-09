async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('quay')
    g.renderer.setSize(1280, 760, false)
    g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix()
  })
  await page.waitForTimeout(2500)
  const shots = [
    ['A-spawn',   4, 1.0, 26],
    ['B-berth',   6.6, 1.0, 12],
    ['C-apron',   -20, 1.0, 30],
    ['D-wharfend',-28, 0.5, -2],
    ['E-manly',   118, 1.6, -556+14+18],
    ['F-corso',   118, 1.6, -556-30+8],
    ['G-beach',   118, 1.0, -556-24],
  ]
  for (const [n,x,y,z] of shots) {
    await page.evaluate((s) => {
      const g = window.__capy, b = g.capy.body
      b.position.set(s[1], s[2], s[3]); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, [n,x,y,z])
    await page.waitForTimeout(2200)
    await page.evaluate(async (n) => {
      const g = window.__capy
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      await fetch('/shot?name=' + n, { method:'POST', body: g.renderer.domElement.toDataURL('image/png') })
    }, 'CQ0-'+n)
  }
}
