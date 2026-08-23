async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  // name, biome, capy x,y,z, cam x,y,z, look x,y,z
  const shots = [
    ['man-corso',  'manly', -12, 4, 46,   -12, 13, 30,   -12, 3, 54],
    ['man-prom',   'manly',  26, 4, 40,    52, 12, 26,   14, 3, 46],
    ['man-beach',  'manly',   4, 3, 31,     8, 14, 52,   0, 0, 20],
    ['man-break',  'manly',   0, 1, -6,     4, 12, 26,   0, 0, -30],
    ['man-point',  'manly',  70, 2, 16,    72, 16, 40,   72, 0, 6],
    ['man-shelly', 'manly',  84, 2, -8,    68, 14, 6,    88, 0, -16],
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
      for (let i = 0; i < 150; i++) g.tick(1/60, false)
    }, s)
    await page.waitForTimeout(300)
    await page.evaluate(async (S) => {
      const g = window.__capy
      g.tick(1/60, false)
      g.camera.position.set(S[5], S[6], S[7])
      g.camera.lookAt(S[8], S[9], S[10])
      g.camera.updateMatrixWorld(true)
      g.post && g.post.enabled ? g.post.render() : g.renderer.render(g.scene, g.camera)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + S[0], { method: 'POST', body: d })
    }, s)
  }
}
