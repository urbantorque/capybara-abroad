async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('iceland')
    const b = g.capy.body
    b.position.set(-40, 1.2, -10)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    b.velocity.set(0, 0, 0)
    g.input.x = 0; g.input.z = 0
  })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'qa/b3ice-dark.png' })
  const before = await page.evaluate(() => ({ aur: +window.__capy.iceland.aurora().toFixed(2),
                                              sky: +window.__capy.iceland.skyward().toFixed(2) }))
  await page.waitForTimeout(11000)
  await page.screenshot({ path: 'qa/b3ice-lit.png' })
  const after = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE, cam = g.camera
    const v = new T.Vector3()
    let vis = 0, tot = 0, sample = null
    g.scene.traverse(o => {
      if (!o.isMesh || o.renderOrder !== -1) return
      if (!o.material || o.material.blending !== T.AdditiveBlending) return
      tot++
      if (o.visible) vis++
      if (!sample) sample = { type: o.material.type, op: +o.material.opacity.toFixed(3),
        depthTest: o.material.depthTest, depthWrite: o.material.depthWrite,
        emissive: o.material.emissive ? o.material.emissive.getHexString() : null,
        emIntensity: o.material.emissiveIntensity,
        color: o.material.color ? o.material.color.getHexString() : null,
        tone: o.material.toneMapped, layers: o.layers.mask, ro: o.renderOrder }
    })
    // what else is in the sky, and in what order
    const sky = []
    g.scene.traverse(o => {
      if (!o.isMesh || !o.visible) return
      const gm = o.geometry
      if (!gm) return
      if (!gm.boundingSphere) { try { gm.computeBoundingSphere() } catch (e) { return } }
      const r = gm.boundingSphere ? gm.boundingSphere.radius : 0
      if (r < 200) return
      o.getWorldPosition(v)
      sky.push({ name: o.name || '?', r: Math.round(r), ro: o.renderOrder,
                 side: o.material && o.material.side, dw: o.material && o.material.depthWrite,
                 dt: o.material && o.material.depthTest, y: +v.y.toFixed(1),
                 mat: o.material && o.material.type })
    })
    return { aur: +g.iceland.aurora().toFixed(2), sky: +g.iceland.skyward().toFixed(2),
             vis, tot, sample, skyMeshes: sky, toneExposure: g.renderer.toneMappingExposure,
             toneMapping: g.renderer.toneMapping }
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=b3ice6.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, { before, after })
}
