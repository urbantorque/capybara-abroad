async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const cam = async (o) => {
    await page.evaluate(async (q) => {
      const g = window.__capy
      if (g.biome.current !== q.biome) { g.biome.switchTo(q.biome) }
      const b = g.capy.body
      const ter = g[q.api].terrainHeight
      b.position.set(q.px, ter(q.px,q.pz)+0.5, q.pz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<(q.warm||400);i++) { g.tick(1/60, false); b.position.set(q.px, ter(q.px,q.pz)+0.5, q.pz); b.velocity.set(0,0,0) }
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix()
      g.tick(1/60, true)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + q.name, { method:'POST', body: d.split(',')[1] })
      await fetch('/shot?name=' + q.name + '.json', { method:'POST',
        body: btoa(JSON.stringify({ sky: g.cave && g.cave.skyward ? g.cave.skyward() : null,
          camY: g.camera.position.y, capY: g.capy.position.y })) })
    }, o)
  }
  await cam({ biome:'cave', api:'cave', px:4, pz:-48, name:'L-cav-doline.png' })
  await cam({ biome:'cave', api:'cave', px:-4, pz:-40, name:'L-cav-doline2.png' })
  await cam({ biome:'cave', api:'cave', px:0, pz:-158, name:'L-cav-slot.png' })
  await cam({ biome:'cave', api:'cave', px:0, pz:47, name:'L-cav-mouth.png' })
}
