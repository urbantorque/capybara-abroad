async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(() => { const g = window.__capy; g.biome.switchTo('antarctic'); g.state.lastError = null })
  await page.waitForTimeout(3500)
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
             locals: (g.locals||[]).filter(l=>l.biome==='antarctic').length, err: g.state.lastError||null }
  })
  const cams = [
    ['ant-station', 6, 22, 74, -14, 4, 52],
    ['ant-glacier', -60, 40, -60, -140, 20, -110],
    ['ant-bones', 100, 16, 30, 114, 2, 14],
    ['ant-colony', 24, 13, 118, 24, 3, 90],
  ]
  for (const c of cams) {
    await page.evaluate(async (a) => {
      const g = window.__capy
      g.renderer.setSize(1280, 760, false)
      g.tick(1/60, true)
      g.camera.position.set(a[1], a[2], a[3])
      g.camera.lookAt(a[4], a[5], a[6])
      g.renderer.render(g.scene, g.camera)
      await fetch('/shot?name=' + a[0], { method:'POST', body: g.renderer.domElement.toDataURL('image/png') })
    }, c)
    await page.waitForTimeout(500)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=p5ant.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
