async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const shots = [
    ['gor-field',  'goreme', 0, 6, 4,    -4, 16, 34,   0, 4, 2],
    ['gor-plaza',  'goreme', 0, 8, 34,   -8, 15, 22,   -6, 7, 42],
    ['gor-crew',   'goreme', -5, 5, 14,  2, 9, 26,     -6, 4, 13],
    ['gor-valley', 'goreme', 0, 4, -40,  20, 30, -6,   0, 0, -55],
    ['gor-air',    'goreme', 0, 6, 4,    -30, 90, 60,  10, 30, -30],
  ]
  for (const s of shots) {
    await page.evaluate(async (S) => {
      const g = window.__capy
      if (g.biome.current !== S[1]) g.biome.switchTo(S[1])
      const b = g.capy.body
      b.position.set(S[2], S[3], S[4]); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix()
      for (let i = 0; i < 200; i++) g.tick(1/60, false)
    }, s)
    await page.waitForTimeout(300)
    await page.evaluate(async (S) => {
      const g = window.__capy
      g.tick(1/60, false)
      g.camera.position.set(S[5], S[6], S[7])
      g.camera.lookAt(S[8], S[9], S[10])
      g.camera.updateMatrixWorld(true)
      g.post && g.post.enabled ? g.post.render() : g.renderer.render(g.scene, g.camera)
      await fetch('/shot?name=' + S[0], { method: 'POST', body: g.renderer.domElement.toDataURL('image/png') })
    }, s)
  }
}
