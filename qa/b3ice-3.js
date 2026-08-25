async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 160)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  // park in the pool, facing SOUTH (away from the curtain fan, which is a fan
  // across the north) — the worst-case yaw a player can arrive with
  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('iceland')
    const b = g.capy.body
    b.position.set(-40, 1.2, -10)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    b.velocity.set(0, 0, 0)
    g.input.x = 0; g.input.z = 0
    // record every sfx call from here on
    window.__sfx = []
    const orig = g.sfx.bind(g)
    g.sfx = function (n, o) {
      window.__sfx.push({ n: n, at: !!(o && (o.at || typeof o.x === 'number')),
                          vol: o && o.volume, t: +(performance.now() / 1000).toFixed(2) })
      return orig(n, o)
    }
  })
  await page.waitForTimeout(1200)
  // face south: yaw the camera to look down +Z
  await page.evaluate(() => {
    const g = window.__capy
    if (g.hud && g.hud.camAudit) window.__cam0 = g.hud.camAudit()
  })
  await page.waitForTimeout(9500)          // the seven-second soak, in real time
  const mid = await page.evaluate(() => {
    const g = window.__capy, I = g.iceland
    return { aurora: +I.aurora().toFixed(3), skyward: +I.skyward().toFixed(2),
             soak: +I.soak().toFixed(2), done: g.hud.isTaskDone('hot-spring'),
             loaf: +g.capy.loaf.toFixed(2),
             camY: +g.camera.position.y.toFixed(2),
             camPitch: +(Math.atan2(g.camera.position.y - g.capy.position.y,
               Math.hypot(g.camera.position.x - g.capy.position.x,
                          g.camera.position.z - g.capy.position.z)) * 57.2958).toFixed(1),
             camYaw: +(Math.atan2(g.camera.position.x - g.capy.position.x,
                                  g.camera.position.z - g.capy.position.z) * 57.2958).toFixed(1),
             camDist: +Math.hypot(g.camera.position.x - g.capy.position.x,
                                  g.camera.position.z - g.capy.position.z).toFixed(2) }
  })
  await page.waitForTimeout(4500)
  const shot = await page.evaluate(() => {
    const g = window.__capy, I = g.iceland
    // how much of the frame is curtain? project each curtain centre into NDC
    const v = new g.THREE.Vector3()
    let inFrame = 0, tot = 0, bestEl = -99
    g.scene.traverse(o => {
      if (!o.isMesh || o.renderOrder !== -1 || !o.visible) return
      if (!o.material || o.material.blending !== g.THREE.AdditiveBlending) return
      tot++
      o.getWorldPosition(v)
      const dx = v.x - g.camera.position.x, dz = v.z - g.camera.position.z
      const el = Math.atan2(60 - g.camera.position.y, Math.hypot(dx, dz)) * 57.2958
      v.project(g.camera)
      if (Math.abs(v.x) < 1 && v.y > -1 && v.y < 1.6) inFrame++
      if (el > bestEl) bestEl = el
    })
    return { aurora: +I.aurora().toFixed(3), skyward: +I.skyward().toFixed(2),
             auroraDone: g.hud.isTaskDone('aurora'),
             curtains: tot, curtainsInFrame: inFrame, bestElevDeg: +bestEl.toFixed(1),
             camPitch: +(Math.atan2(g.camera.position.y - g.capy.position.y,
               Math.hypot(g.camera.position.x - g.capy.position.x,
                          g.camera.position.z - g.capy.position.z)) * 57.2958).toFixed(1),
             camDist: +Math.hypot(g.camera.position.x - g.capy.position.x,
                                  g.camera.position.z - g.capy.position.z).toFixed(2),
             sfx: window.__sfx.slice(-24) }
  })
  const out = { mid, shot, errs: errs.slice(0, 6) }
  await page.evaluate(async o => {
    await fetch('/shot?name=b3ice3.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
