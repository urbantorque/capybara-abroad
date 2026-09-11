async page => {
  const out = { rows: [] }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(2000)
  for (const b of ['manly', 'pantanal', 'quay']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(9000)
    const info = await page.evaluate(() => {
      const g = window.__capy
      let f = null
      g.scene.traverse(function (o) { if (o.isInstancedMesh && o.renderOrder === -19) f = o })
      if (!f) return { mesh: false }
      const m = new g.THREE.Matrix4(), p = new g.THREE.Vector3()
      const s = new g.THREE.Vector3(), q = new g.THREE.Quaternion()
      let live = 0, els = []
      for (let i = 0; i < f.count; i++) {
        f.getMatrixAt(i, m); m.decompose(p, q, s)
        if (s.x < 0.001) continue
        live++
        if (i % 3 === 0) els.push(+(Math.atan2(p.y, Math.hypot(p.x, p.z)) * 180 / Math.PI).toFixed(1))
      }
      const par = f.parent
      return { mesh: true, cur: g.biome.current, visible: f.visible,
               parentVisible: par ? par.visible : null,
               parentIsDome: !!(par && par.geometry && par.geometry.type === 'SphereGeometry' && par.renderOrder === -20),
               live: live, els: els,
               color: '#' + f.material.color.getHexString(),
               emissive: '#' + f.material.emissive.getHexString(),
               bg: g.scene.background && g.scene.background.isColor ? '#' + g.scene.background.getHexString() : null,
               camY: +g.camera.position.y.toFixed(2) }
    })
    out.rows.push(info)
    // The decisive experiment: paint them red. If red appears, the geometry and
    // the placement are right and only the VALUE is wrong.
    await page.evaluate(() => {
      const g = window.__capy
      g.scene.traverse(function (o) {
        if (o.isInstancedMesh && o.renderOrder === -19) {
          o.material.color.setRGB(1, 0, 0); o.material.emissive.setRGB(0.5, 0, 0)
          o.userData.pinned = 1
        }
      })
    })
    await page.waitForTimeout(600)
    await page.screenshot({ path: 'qa/m1-diag-' + b + '-red.png' })
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=m1-diag.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
