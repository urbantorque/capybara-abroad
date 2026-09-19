async page => {
  // A1 rollout scout: where does a chapter's water fill the frame? One position, four bearings,
  // the water mask % of each (colour-keyed raw render of the reflect-tagged sheets) and a shot.
  const CH = 'iceland', AT = [26, 0.8, 139], YAWS = [0, Math.PI / 2, Math.PI, -Math.PI / 2]
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(1500)
  await page.evaluate((n) => window.__capy.hud.cross(n), CH)
  await page.waitForTimeout(6000)
  await page.evaluate(([x, y, z]) => { const b = window.__capy.capy.body; b.position.set(x, y, z); b.velocity.set(0, 0, 0); if (b.interpolatedPosition) b.interpolatedPosition.set(x, y, z) }, AT)
  await page.waitForTimeout(1500)
  const out = []
  for (let i = 0; i < YAWS.length; i++) {
    await page.evaluate((yaw) => window.__capy.frameShot({ yaw, dist: 11, pitch: 0.28, raise: 1.6, hold: 20 }), YAWS[i])
    await page.waitForTimeout(2200)
    const r = await page.evaluate(async (i) => {
      const g = window.__capy, T = g.THREE
      const waters = []
      g.scene.traverse(o => { if (o.isMesh && o.visible && o.material && o.material.userData && o.material.userData.grainReflect > 0) waters.push(o) })
      const W = g.renderer.domElement.width, H = g.renderer.domElement.height
      const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
      const ctx = c2.getContext('2d', { willReadFrequently: true })
      const key = new T.MeshBasicMaterial({ color: 0xff00ff, fog: false })
      const saved = waters.map(w => w.material); waters.forEach(w => { w.material = key })
      g.renderer.setRenderTarget(null); g.renderer.render(g.scene, g.camera)
      ctx.drawImage(g.renderer.domElement, 0, 0); const km = ctx.getImageData(0, 0, W, H).data
      waters.forEach((w, k) => { w.material = saved[k] })
      let m = 0; for (let j = 0; j < km.length; j += 4) if (km[j] > 180 && km[j + 1] < 90 && km[j + 2] > 180) m++
      g.reflectDraw(); g.post.render()
      ctx.drawImage(g.renderer.domElement, 0, 0)
      await fetch('/shot?name=wow-reflect-scout-' + i, { method: 'POST', body: c2.toDataURL('image/png') })
      const c = g.camera.position
      return { i, maskPct: +(100 * m / (W * H)).toFixed(1), cam: [+c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1)], why: g.reflectInfo().why }
    }, i)
    out.push(r)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wow-reflect-scout.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
