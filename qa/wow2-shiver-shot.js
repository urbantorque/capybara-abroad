async page => {
  // ROADMAP-WOW2 V2.2 — a picture of the shiver, in the chapter that has it.
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(5200)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(9000)
  await page.evaluate(() => window.__capy.hud.cross('iceland'))
  await page.waitForTimeout(9500)
  const r = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE
    let row = null
    for (let t = 0; t < 40 * 60 && !row; t++) {
      g.tick(1 / 60, false)
      if (t % 8) continue
      row = (g.peopleAudit.gesture().rows || []).find(r => r.g === 'shiver' && r.w > 0.85) || null
    }
    if (!row) return null
    const rc = new T.Raycaster(), head = new T.Vector3(row.x, row.y + 1.4, row.z)
    let yaw = (row.yaw || 0) + 0.5
    for (let k = 0; k < 8; k++) {
      const yy = yaw + k * 0.785
      const pos = new T.Vector3(row.x + Math.sin(yy) * 3.4, row.y + 1.8, row.z + Math.cos(yy) * 3.4)
      rc.set(pos, head.clone().sub(pos).normalize())
      const hits = rc.intersectObjects(g.scene.children, true).filter(h => h.object.visible && h.distance > 0.2)
      if (!hits.length || hits[0].distance > pos.distanceTo(head) - 0.9) { yaw = yy; break }
    }
    const cam = g.camera.clone()
    cam.position.set(row.x + Math.sin(yaw) * 3.4, row.y + 1.8, row.z + Math.cos(yaw) * 3.4)
    cam.lookAt(row.x, row.y + 1.25, row.z)
    cam.updateMatrixWorld(true)
    g.renderer.setRenderTarget(null); g.renderer.render(g.scene, cam)
    const d = g.renderer.domElement.toDataURL('image/png')
    await fetch('/shot?name=wow2-gest-shiver', { method: 'POST', body: d.split(',')[1] })
    return row
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-shiver-shot.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, r)
}
