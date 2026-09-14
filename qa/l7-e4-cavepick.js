async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6500)
  await page.evaluate(() => window.__capy.hud.cross('cave'))
  await page.waitForTimeout(9000)
  await page.keyboard.down('KeyW'); await page.waitForTimeout(3200); await page.keyboard.up('KeyW')
  await page.waitForTimeout(14000)
  const out = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const rc = new T.Raycaster()
    const root = g.scene.getObjectByName('cave')
    const rows = []
    for (const [px, py] of [[400, 110], [560, 110], [400, 160], [560, 160], [400, 230], [560, 230], [400, 300], [800, 60], [1000, 200]]) {
      rc.setFromCamera(new T.Vector2(px / W * 2 - 1, 1 - py / H * 2), g.camera)
      const hits = rc.intersectObject(root, true).filter(h => h.object.visible && h.object.material && !h.object.material.transparent && h.object.material.depthWrite !== false && h.distance > 2)
      const h = hits[0]
      if (!h) { rows.push({ px, py, hit: null }); continue }
      const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : null
      const m = h.object.material
      rows.push({ px, py, obj: h.object.name || h.object.type, mat: m && m.uuid.slice(0, 6), key: m && m.customProgramCacheKey ? m.customProgramCacheKey().slice(0, 90) : null,
        p: h.point.toArray().map(v => +v.toFixed(2)), n: n && n.toArray().map(v => +v.toFixed(2)), d: +h.distance.toFixed(1), vc: !!(h.object.geometry.attributes.color), shore: m && m.userData && m.userData.grainShore, col: h.object.geometry.attributes.color ? [h.face.a].map(i => [h.object.geometry.attributes.color.getX(i), h.object.geometry.attributes.color.getY(i), h.object.geometry.attributes.color.getZ(i)].map(v => +v.toFixed(2)))[0] : null })
    }
    return { cam: g.camera.position.toArray().map(v => +v.toFixed(2)), rows }
  })
  await page.evaluate((o) => fetch('/shot?name=l7-e4-cavepick.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
