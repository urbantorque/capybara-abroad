async page => {
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('sahara')
    const b = g.capy.body, sa = g.sahara
    const res = []
    g.renderer.setSize(1280, 760, false)
    g.camera.aspect = 1280 / 760; g.camera.updateProjectionMatrix()
    for (const s of [{ n: 'S8-loaf-square', x: 11.5, z: -1 }, { n: 'S9-loaf-erg', x: 220, z: 40 }]) {
      const y = sa.terrainHeight(s.x, s.z) + 1.0
      b.position.set(s.x, y, s.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      const marks = []
      for (let i = 0; i < 60 * 40; i++) {
        g.input.x = 0; g.input.z = 0; g.input.run = false
        g.tick(1 / 60, false)
        if (i % 300 === 0) marks.push([+(i / 60).toFixed(0), +g.capy.loaf.toFixed(2),
          +Math.hypot(g.camera.position.x - g.capy.position.x, g.camera.position.z - g.capy.position.z).toFixed(1),
          +(g.camera.position.y - g.capy.position.y).toFixed(1)])
      }
      g.tick(1 / 60, true)
      const url = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + s.n + '.png', { method: 'POST', body: url.split(',')[1] })
      res.push({ n: s.n, marks, loaf: +g.capy.loaf.toFixed(2) })
    }
    return res
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=b3sah-k.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
