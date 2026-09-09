async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const shots = [
    ['pal-reef',  'palawan', -13, -5.0, 4,   -13, -2.0, 20,   -13, -6.5, -4],
    ['pal-beach', 'palawan', 0, 2.0, 46,     -6, 14, 62,      0, 1, 40],
    ['pal-huts',  'palawan', 12, 2.0, 50,    12, 10, 40,      14, 2, 56],
    ['pal-drop',  'palawan', 8, -8, -18,     8, -4, 0,        14, -10, -22],
    ['pal-cath',  'palawan', 2.5, -6, -115,  2.5, -5, -104,   2.5, 4, -117],
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
      for (let i = 0; i < 90; i++) { g.tick(1/60, false); b.position.set(S[2], S[3], S[4]); b.velocity.set(0,0,0) }
    }, s)
    await page.waitForTimeout(250)
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
