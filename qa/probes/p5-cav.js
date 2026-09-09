async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const shots = [
    ['cav-entrance', 6, 4, 44, 3.14],
    ['cav-passage', 0, -2, 0, 3.14],
    ['cav-doline', 4, 2, -30, 3.14],
    ['cav-camp', 16, 2, -38, 3.4],
    ['cav-wall', 0, 2, -92, 3.14],
  ]
  for (const s of shots) {
    await page.evaluate((a) => {
      const g = window.__capy
      if (g.biome.current !== 'cave') { g.biome.switchTo('cave'); g.state.lastError = null }
      const b = g.capy.body
      const y = g.cave.terrainHeight(a[1], a[3]) + 1.2
      b.position.set(a[1], y, a[3]); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.input.camYaw = a[4]
    }, s)
    await page.waitForTimeout(2600)
    await page.evaluate(async (name) => {
      const g = window.__capy
      g.renderer.setSize(1280, 760, false)
      g.tick(1/60, true)
      await fetch('/shot?name=' + name, { method:'POST', body: g.renderer.domElement.toDataURL('image/png') })
    }, s[0])
  }
  const out = await page.evaluate(() => {
    const g = window.__capy
    let tris = 0
    g.scene.traverse(o => {
      if (!o.isMesh && !o.isInstancedMesh) return
      for (let p = o; p; p = p.parent) if (!p.visible) return
      const gm = o.geometry
      const t = gm && gm.index ? gm.index.count/3 : (gm && gm.attributes.position ? gm.attributes.position.count/3 : 0)
      tris += t * (o.isInstancedMesh ? (o.count||0) : 1)
    })
    return { tris: Math.round(tris), bodies: g.world.bodies.length,
             locals: (g.locals||[]).filter(l=>l.biome==='cave').length, err: g.state.lastError||null }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=p5cav.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
