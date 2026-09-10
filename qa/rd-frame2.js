async page => {
  // rd-frame2.js — as rd-frame, but it ASSERTS started before it measures
  // anything, and it re-asserts every chapter. Trap 40: hud.cross() and body
  // writes work perfectly with started === false, and the rest lens is gated
  // on started, so the whole sweep reads as a rig that never opens out.
  const out = { rows: [], startedAt: null }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(2500)
  out.startedAt = await page.evaluate(() => window.__capy.state.started)

  const probe = () => {
    const g = window.__capy
    const THREEx = g.THREE
    const cam = g.camera
    cam.updateMatrixWorld(true)
    const fwd = new THREEx.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
    const pitch = Math.asin(-fwd.y)
    const halfV = (cam.fov * Math.PI / 180) / 2
    const rc = new THREEx.Raycaster()
    const solid = []
    g.scene.traverse((o) => {
      if (!o.isMesh) return
      for (let p = o; p; p = p.parent) if (!p.visible) return
      solid.push(o)
    })
    let hit = 0, tot = 0
    for (let ix = 0; ix < 21; ix++) {
      for (let iy = 0; iy < 13; iy++) {
        const nx = -1 + (2 * ix) / 20, ny = -1 + (2 * iy) / 12
        rc.setFromCamera({ x: nx, y: ny }, cam)
        rc.far = 900
        const h = rc.intersectObjects(solid, false)
        tot++
        let real = false
        for (let k = 0; k < h.length; k++) {
          const o = h[k].object
          const n = (o.name || '') + '|' + (o.geometry && o.geometry.type || '')
          if (n.indexOf('sky') >= 0 || n.indexOf('Sky') >= 0) continue
          real = true; break
        }
        if (real) hit++
      }
    }
    return { st: g.state.started,
             pitch: +(pitch * 180 / Math.PI).toFixed(1),
             fov: +cam.fov.toFixed(1),
             hor: +(Math.tan(pitch) / Math.tan(halfV)).toFixed(2),
             sky: +(100 * (1 - hit / tot)).toFixed(1),
             rest: +(g.camInfo.rest || 0).toFixed(3),
             idle: +(g.camInfo.idle || 0).toFixed(2),
             dist: +(g.camInfo.dist || 0).toFixed(2) }
  }

  const list = ['pasto', 'kyoto', 'rio', 'iceland', 'sahara', 'venice',
                'kowloon', 'palawan', 'goreme', 'manly', 'pantanal',
                'antarctic', 'monaco', 'hanoi', 'quay', 'cali', 'cave', 'sydney']
  for (const b of list) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(8000)
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(2500)
    const walk = await page.evaluate(probe)
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(11000)   // sysREST_T 1.5 + the 2.5 s blend, and slack
    const rest = await page.evaluate(probe)
    out.rows.push({ b, cur: await page.evaluate(() => window.__capy.biome.current), walk, rest })
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rd-frame2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
