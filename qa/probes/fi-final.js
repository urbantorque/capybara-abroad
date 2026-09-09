async page => {
  await page.evaluate(()=>{try{localStorage.clear()}catch(e){}}).catch(()=>{})
  await page.reload()
  await page.waitForTimeout(5200)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const shots = [
    ['F7-man-arrive', 'manly', 0, 40, 3.14],
    ['F7-man-beach', 'manly', 6, 30, 3.14],
    ['F7-man-corso', 'manly', -13, 46, 0],
    ['F7-man-prom', 'manly', 30, 43, 4.2],
    ['F7-pan-nest', 'pantanal', 50, 26, 3.14],
    ['F7-pan-faz', 'pantanal', 24, 62, 0.4],
    ['F7-pan-cross', 'pantanal', -34, -62, 3.14],
    ['F7-pan-campo', 'pantanal', -8, 20, 3.14],
  ]
  for (const s of shots) {
    await page.evaluate(async (a) => {
      const g = window.__capy
      if (g.biome.current !== a[1]) { g.biome.switchTo(a[1]); await new Promise(r=>setTimeout(r,500)) }
      const dx = Math.sin(a[4]), dz = Math.cos(a[4])
      const sx = a[2] - dx * 11, sz = a[3] - dz * 11
      const api = g[a[1]]
      const y = (api && api.terrainHeight ? api.terrainHeight(sx, sz) : 0) + 1.2
      const b = g.capy.body
      b.position.set(sx, y, sz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.capy.position.set(sx, y, sz)
      for (let i = 0; i < 40; i++) g.tick(1/60, false)
      for (let i = 0; i < 400; i++) {
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
