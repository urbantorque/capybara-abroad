async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const shots = [
    ['F0-man-spawn', 'manly', 0, 3.2, 46, 0],
    ['F0-man-corso', 'manly', -12, 3.6, 50, 0],
    ['F0-man-beach', 'manly', 6, 1.6, 30, 0],
    ['F0-man-surf', 'manly', 0, 0.5, 6, 0],
    ['F0-man-point', 'manly', 70, 1.6, 16, 1.6],
    ['F0-man-shelly', 'manly', 84, 1.4, -14, 2.4],
    ['F0-pan-spawn', 'pantanal', 0, 3, 62, 0],
    ['F0-pan-campo', 'pantanal', -8, 2, 30, 0],
    ['F0-pan-faz', 'pantanal', 36, 4, 92, 3.14],
    ['F0-pan-river', 'pantanal', -34, 1, -60, 0],
    ['F0-pan-baia', 'pantanal', -30, 1.5, 8, 1.6],
    ['F0-pan-nest', 'pantanal', 50, 2, 30, 3.14],
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
    await page.evaluate(async (name) => {
      const g = window.__capy
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix()
      g.tick(1/60, true)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + name, { method:'POST', body: d })
    }, s[0])
  }
}
