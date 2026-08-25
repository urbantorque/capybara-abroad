async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 160)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)

  const out = await page.evaluate(async () => {
    const g = window.__capy
    const R = { issues: [] }
    const settle = n => { for (let i = 0; i < n; i++) g.tick(1 / 60, false) }
    g.biome.switchTo('iceland')
    const sp = g.biome.spawnOf('iceland'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    settle(120)
    const I = g.iceland

    // sit in the spring until the aurora arms and ignites
    const pool = I.spring || I.pool || { x: -40, z: -10 }
    b.position.set(pool.x, 0.2, pool.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    let ignited = -1, t = 0, peakFraming = 0
    for (let i = 0; i < 60 * 60 && ignited < 0; i++) {
      settle(1); t += 1 / 60
      const fr = g.framing(); if (fr > peakFraming) peakFraming = fr
      if (I.skyward && I.skyward() > 0.9) ignited = +t.toFixed(1)
    }
    R.ignitedAtS = ignited
    R.peakFraming = +peakFraming.toFixed(3)
    if (ignited < 0) { R.issues.push('the aurora never ignited in 60 s of soaking'); return R }

    // the envelope only STARTS on the ignition frame — keep sampling through it
    for (let i = 0; i < 60 * 4; i++) { settle(1); const fr = g.framing(); if (fr > peakFraming) peakFraming = fr }
    R.peakFraming = +peakFraming.toFixed(3)

    // ---- THE MEASUREMENT: how many curtain vertices are in front of the eye?
    settle(30)
    const cam = g.camera
    cam.updateMatrixWorld(true)
    const T = g.THREE || (g.camera.constructor && window.THREE)
    const V3 = cam.position.constructor
    const fwd = new V3(0, 0, -1).applyQuaternion(cam.quaternion).normalize()
    const eye = cam.position
    let total = 0, inFront = 0, best = -2, worst = 2
    const v = new V3()
    g.scene.traverse(obj => {
      if (!obj.isMesh || !obj.geometry || !obj.geometry.attributes || !obj.geometry.attributes.position) return
      const m = obj.material
      const em = m && (m.emissive || (Array.isArray(m) && m[0] && m[0].emissive))
      // the curtains are the big transparent planes in the sky rig
      if (!m || !m.transparent) return
      const pos = obj.geometry.attributes.position
      if (pos.count < 60 || pos.count > 400) return
      obj.updateMatrixWorld(true)
      for (let k = 0; k < pos.count; k += 3) {
        v.fromBufferAttribute(pos, k).applyMatrix4(obj.matrixWorld)
        if (v.y < 20) continue                       // sky only
        v.sub(eye).normalize()
        const d = v.dot(fwd)
        total++
        if (d > best) best = d
        if (d < worst) worst = d
        if (d > 0.2) inFront++
      }
    })
    R.skyVerts = total
    R.vertsInFront = inFront
    R.bestDot = +best.toFixed(3)
    R.worstDot = +worst.toFixed(3)
    R.camFwd = [+fwd.x.toFixed(2), +fwd.y.toFixed(2), +fwd.z.toFixed(2)]
    if (total === 0) R.issues.push('THIS PROBE FOUND NO SKY GEOMETRY AT ALL — it is measuring nothing')
    else if (inFront === 0) R.issues.push('0 of ' + total + ' curtain vertices are in front of the camera (best dot ' + R.bestDot + ')')
    if (peakFraming < 0.9) R.issues.push('the ignition did not frame: peak w = ' + peakFraming)
    R.lastError = g.state.lastError || null
    return R
  })
  out.pageErrors = errs
  await page.evaluate(async o => {
    await fetch('/shot?name=b3-ice-aurora.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
