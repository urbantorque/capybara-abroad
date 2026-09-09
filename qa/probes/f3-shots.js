async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const shots = [
    ['F1-man-arrive', 'manly', 0, 3.2, 46, 3.14],
    ['F1-man-fromsand','manly', 0, 1.6, 30, 3.14],
    ['F1-man-break', 'manly', 0, 0.5, -6, 3.14],
    ['F1-man-back', 'manly', 0, 0.5, -34, 0],
    ['F1-man-corso2', 'manly', 20, 3.6, 48, 1.57],
    ['F1-man-pool', 'manly', 71, 1.6, 15, 3.14],
    ['F1-pan-arrive', 'pantanal', 0, 3, 62, 3.14],
    ['F1-pan-nest2', 'pantanal', 50, 2, 30, 3.14],
    ['F1-pan-campo2', 'pantanal', 60, 2, 60, 3.14],
    ['F1-pan-cross', 'pantanal', -34, 0.6, -62, 3.14],
    ['F1-pan-edge', 'pantanal', 36, 4, 98, 0],
    ['F1-pan-bar', 'pantanal', 34, 1, -68, 1.57],
  ]
  for (const s of shots) {
    await page.evaluate((a) => {
      const g = window.__capy
      if (g.biome.current !== a[1]) g.biome.switchTo(a[1])
      const b = g.capy.body
      b.position.set(a[2], a[3], a[4]); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.input.camYaw = a[5]
    }, s)
    await page.waitForTimeout(2200)
    await page.evaluate(async (a) => {
      const g = window.__capy
      g.input.camYaw = a[5]
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix()
      g.tick(1/60, true)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + a[0], { method:'POST', body: d })
    }, s)
  }
}
