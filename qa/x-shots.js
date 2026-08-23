async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const shots = [
    ['X-pan-spawn', 'pantanal', 0, 3, 62, 0],
    ['X-pan-campo', 'pantanal', 20, 2, 18, 0],
    ['X-pan-river', 'pantanal', -34, 2, -58, 0],
    ['X-cav-mouth', 'cave', 0, 4, 58, 0],
    ['X-cav-pass', 'cave', 0, -4, 0, 0],
    ['X-cav-doline', 'cave', 4, -2, -30, 0],
    ['X-ant-spawn', 'antarctic', 0, 7.1, 52, 0],
    ['X-ant-colony', 'antarctic', 24, 12, 78, 0],
    ['X-ant-glacier', 'antarctic', -84, 4, -110, 0],
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
    await page.waitForTimeout(2600)
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
