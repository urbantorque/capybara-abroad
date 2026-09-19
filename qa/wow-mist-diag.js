// G3 diagnostic: why does the band draw in Iceland and not in Venice?
async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  const out = { errs, rows: {} }
  for (const name of ['venice']) {
    await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
    await page.setViewportSize({ width: 1280, height: 760 })
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.evaluate(() => document.querySelector('.capyui-go').click())
    await page.waitForTimeout(1500)
    await page.evaluate((n) => window.__capy.hud.cross(n), name)
    await page.waitForTimeout(11000)
    out.rows[name] = await page.evaluate(async (n) => {
      const g = window.__capy, T = g.THREE
      g.weather.mistSet(n, { alpha: 4, tint: 0xff0000, h: 2.0, tide: null })
      g.state.noMist = false
      async function shoot(tag) {
        g.tick(1 / 60, true)
        const d = g.renderer.domElement.toDataURL('image/png')
        await fetch('/shot?name=wow-mist-diag-' + n + '-' + tag, { method: 'POST', body: d.split(',')[1] })
      }
      await shoot('a')
      const m = g.scene.getObjectByName('wxMist')
      const info = {}
      if (m) {
        m.updateMatrixWorld(true)
        const wp = new T.Vector3(); m.getWorldPosition(wp)
        info.pos = [wp.x, wp.y, wp.z]
        info.visible = m.visible, info.parentVisible = m.parent && m.parent.visible
        info.layers = m.layers.mask, info.camLayers = g.camera.layers.mask
        info.renderOrder = m.renderOrder
        info.mat = { transparent: m.material.transparent, depthTest: m.material.depthTest, depthWrite: m.material.depthWrite, side: m.material.side, blending: m.material.blending, visible: m.material.visible, opacity: m.material.opacity }
        info.uniforms = { alpha: m.material.uniforms.uAlpha.value, h: m.material.uniforms.uH.value, tint: m.material.uniforms.uTint.value.getHex(), centre: m.material.uniforms.uCentre.value.toArray(), R: m.material.uniforms.uR.value }
        info.geoCount = m.geometry.attributes.position.count
        info.cam = g.camera.position.toArray()
        info.camNearFar = [g.camera.near, g.camera.far]
        info.capy = g.capy.position.toArray()
        // the program's diagnostics, if three kept any
        const progs = g.renderer.info.programs || []
        info.progs = progs.length
        info.diag = progs.filter(p => p.diagnostics).map(p => p.diagnostics)
        // any other object in the scene with a renderOrder above 8?
        const high = []
        g.scene.traverse(o => { if (o.isMesh && o.visible && o.renderOrder > 8) high.push([o.name || o.type, o.renderOrder, !!o.material.transparent, !!o.material.depthWrite]) })
        info.high = high.slice(0, 20)
        // no depth test
        m.material.depthTest = false
        await shoot('b')
        m.material.depthTest = true
        // move the sheets a metre up
        m.position.y += 1
        m.updateMatrixWorld(true)
        await shoot('c')
        // and a plain red MeshBasicMaterial on the same geometry
        const old = m.material
        m.material = new T.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5, depthWrite: false })
        await shoot('d')
        m.material = old
      }
      return info
    }, name)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=wow-mist-diag.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
