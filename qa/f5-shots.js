async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  // [name, biome, x, z, headingRad]  heading: 0=+z(north) PI=-z(south) 1.57=+x
  const shots = [
    ['F3-man-arrive', 'manly', 0, 46, 3.14],
    ['F3-man-fromsand','manly', 0, 30, 3.14],
    ['F3-man-break', 'manly', 0, -6, 3.14],
    ['F3-man-back', 'manly', 0, -34, 0],
    ['F3-man-corso', 'manly', -13, 46, 0],
    ['F3-man-pool', 'manly', 71, 15, 3.14],
    ['F3-pan-arrive', 'pantanal', 0, 62, 3.14],
    ['F3-pan-campo', 'pantanal', 50, 34, 3.14],
    ['F3-pan-cross', 'pantanal', -34, -62, 3.14],
    ['F3-pan-edge', 'pantanal', 36, 96, 0],
    ['F3-pan-bar', 'pantanal', 34, -60, 3.14],
    ['F3-pan-baia', 'pantanal', -30, 8, 4.71],
  ]
  for (const s of shots) {
    await page.evaluate(async (a) => {
      const g = window.__capy
      if (g.biome.current !== a[1]) { g.biome.switchTo(a[1]); await new Promise(r=>setTimeout(r,400)) }
      const dx = Math.sin(a[4]), dz = Math.cos(a[4])
      const sx = a[2] - dx * 11, sz = a[3] - dz * 11
      const api = g[a[1]]
      const y = (api && api.terrainHeight ? api.terrainHeight(sx, sz) : 0) + 1.2
      const b = g.capy.body
      b.position.set(sx, y, sz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.capy.position.set(sx, y, sz)
      for (let i = 0; i < 40; i++) g.tick(1/60, false)
      // walk toward the target, camera-relative
      for (let i = 0; i < 320; i++) {
        const p = g.capy.position
        const cy = Math.cos(g.input.camYaw), sy = Math.sin(g.input.camYaw)
        const ddx = a[2] - p.x, ddz = a[3] - p.z, len = Math.hypot(ddx, ddz) || 1
        if (len < 1.2) break
        const nx = ddx/len, nz = ddz/len
        g.input.x = nx*cy - nz*sy
        g.input.z = nx*sy + nz*cy
        g.tick(1/60, false)
      }
      g.input.x = 0; g.input.z = 0
      for (let i = 0; i < 70; i++) g.tick(1/60, false)
    }, s)
    await page.waitForTimeout(300)
    await page.evaluate(async (a) => {
      const g = window.__capy
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix()
      g.tick(1/60, true)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + a[0], { method:'POST', body: d })
    }, s)
  }
}
