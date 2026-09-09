async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  // [name, biome, x, y, z, headingYaw]  heading: 0=+z(north) PI=-z(south)
  const shots = [
    ['F2-man-arrive', 'manly', 0, 3.2, 46, 3.14],
    ['F2-man-fromsand','manly', 0, 1.6, 30, 3.14],
    ['F2-man-break', 'manly', 0, 0.5, -6, 3.14],
    ['F2-man-back', 'manly', 0, 0.5, -34, 0],
    ['F2-man-corso', 'manly', -13, 3.6, 46, 0],
    ['F2-man-pool', 'manly', 71, 1.6, 15, 3.14],
    ['F2-pan-arrive', 'pantanal', 0, 3, 62, 3.14],
    ['F2-pan-campo', 'pantanal', 50, 2, 34, 3.14],
    ['F2-pan-cross', 'pantanal', -34, 0.6, -62, 3.14],
    ['F2-pan-edge', 'pantanal', 36, 4, 96, 0],
    ['F2-pan-bar', 'pantanal', 34, 1, -60, 3.14],
    ['F2-pan-baia', 'pantanal', -30, 1.5, 8, 4.7],
  ]
  for (const s of shots) {
    await page.evaluate((a) => {
      const g = window.__capy
      if (g.biome.current !== a[1]) g.biome.switchTo(a[1])
      const b = g.capy.body
      b.position.set(a[2], a[3], a[4]); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.capy.position.set(a[2], a[3], a[4])
      if (g.capy.group) g.capy.group.rotation.y = a[5]
    }, s)
    await page.waitForTimeout(3200)
    await page.evaluate(async (a) => {
      const g = window.__capy
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix()
      g.tick(1/60, true)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + a[0], { method:'POST', body: d })
    }, s)
  }
}
