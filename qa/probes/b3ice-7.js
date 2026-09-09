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
  await page.waitForTimeout(12000)
  const geom = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE, cam = g.camera, v = new T.Vector3()
    // the dome
    let dome = null
    g.scene.traverse(o => {
      if (!o.isMesh || o.renderOrder !== -10) return
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere()
      o.getWorldPosition(v)
      dome = { r: +o.geometry.boundingSphere.radius.toFixed(1), ox: +v.x.toFixed(1),
               oy: +v.y.toFixed(1), oz: +v.z.toFixed(1),
               dw: o.material.depthWrite, dt: o.material.depthTest, side: o.material.side }
    })
    // curtain distance from the CAMERA
    const ds = []
    g.scene.traverse(o => {
      if (!o.isMesh || o.renderOrder !== -1) return
      if (!o.material || o.material.blending !== T.AdditiveBlending) return
      const pos = o.geometry.attributes.position
      let mn = 1e9, mx = 0
      for (let i = 0; i < pos.count; i += 7) {
        v.fromBufferAttribute(pos, i); o.localToWorld(v)
        const d = v.distanceTo(cam.position)
        if (d < mn) mn = d
        if (d > mx) mx = d
      }
      ds.push([Math.round(mn), Math.round(mx)])
    })
    return { dome, curtainDist: ds, far: cam.far,
             aur: +g.iceland.aurora().toFixed(2) }
  })
  await page.screenshot({ path: 'qa/b3ice-domeon.png' })
  await page.evaluate(() => {
    const g = window.__capy
    g.scene.traverse(o => { if (o.isMesh && o.renderOrder === -10) o.material.depthWrite = false })
  })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/b3ice-domeoff.png' })
  await page.evaluate(async o => {
    await fetch('/shot?name=b3ice7.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, geom)
}
