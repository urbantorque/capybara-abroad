async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1800)
  // A free camera, for looking AT the thing that changed rather than at the
  // capybara. Render and read in ONE turn (harness trap 12) and do not touch
  // setSize, which is what makes that trap bite.
  const VIEWS = [
    ['q-north',  'quay',      60,  40, -300,   236, 20, -498],
    ['q-brad',   'quay',      20,  26, -120,   -76, 14, -196],
    ['q-manly',  'quay',     118,  30, -430,   118,  8, -556],
    ['d-arch',   'drift',      3,  92, -103,  -110, 34,   40],
    ['d-farfld', 'drift',     36, 118, -184,   -74, 74,  268],
    ['p-campo',  'pantanal', -20,   8,   10,  -110,  1,  -90],
    ['p-road',   'pantanal',   2,   6,   40,     2,  1,  -90],
  ]
  const out = {}
  for (const v of VIEWS) {
    out[v[0]] = await page.evaluate(async (V) => {
      const g = window.__capy
      if (g.biome.current !== V[1]) g.biome.switchTo(V[1])
      const sp = g.biome.spawnOf(V[1]), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
      const cam = g.camera
      cam.position.set(V[2], V[3], V[4])
      cam.lookAt(V[5], V[6], V[7])
      cam.updateMatrixWorld(true)
      if (g.post && g.post.enabled) g.post.render(); else g.renderer.render(g.scene, cam)
      const url = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=J2-' + V[0], { method: 'POST', body: url.split(',')[1] })
      return url.length
    }, v)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=b4-view.json', { method: 'POST', body: btoa(JSON.stringify(o)) }) }, out)
}
