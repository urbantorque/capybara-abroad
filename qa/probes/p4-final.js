async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const shots = [
    ['F-man-beach', 'manly', 4, 3, 31,     6, 15, 54,   0, 0, 16,  260],
    ['F-man-corso', 'manly', -12, 4, 46,  -12, 12, 31,  -12, 3, 54, 200],
    ['F-pal-reef',  'palawan', -13, -1.0, 8,  -13, 5.5, 22, -13, -5, -2, 200],
    ['F-pal-beach', 'palawan', 6, 2.0, 48,  -8, 16, 66,  6, 1, 40,  200],
    ['F-gor-plaza', 'goreme', 0, 8, 34,    -9, 14, 21,  -6, 7, 42,  240],
    ['F-gor-dawn',  'goreme', 0, 6, 4,     -34, 96, 66,  14, 34, -34, 2000],
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
      for (let i = 0; i < S[11]; i++) g.tick(1/60, false)
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
