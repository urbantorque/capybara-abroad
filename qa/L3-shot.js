async page => {
  await page.reload(); await page.waitForTimeout(5500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const shots = [
    ['spawn',    2, 31.6, 42,   0.0],
    ['orchard', -30.4, 80, -110.2, 2.3],
    ['arch',     5, 84, -103,   -0.7],
    ['crown',    36, 108, -184,  2.6],
    ['anvil',   -38, 41.5, -47,  0.6],
  ]
  for (const [name, x, y, z, yaw] of shots) {
    await page.evaluate(async (q) => {
      function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
      const g = window.__capy
      if (!g.biome.isActive('drift')) { g.biome.switchTo('drift'); await sleep(1600) }
      const b = g.capy.body
      b.position.set(q.x, q.y + 0.6, q.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.input.camYaw = q.yaw
      g.renderer.setSize(1280, 760, false)
      for (let i=0;i<90;i++) g.tick(1/60, false)
      await sleep(500)
      g.tick(1/60, true)
      const url = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=L3-' + q.name + '.png', { method:'POST', body: url.split(',')[1] })
    }, { name, x, y, z, yaw })
    await page.waitForTimeout(400)
  }
}
