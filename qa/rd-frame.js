async page => {
  // rd-frame.js — WHAT IS ACTUALLY IN THE FRAME, walking versus settled.
  //
  // The horizon's height in the picture is tan(pitch)/tan(halfFov) in NDC and
  // depends on nothing else, so it is computable exactly from the live camera
  // rather than guessed from a screenshot. Sky fraction is measured the honest
  // way instead: a 21x13 ray grid, counting rays that hit nothing.
  const out = { rows: [] }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5200)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(3500)

  const probe = () => {
    const g = window.__capy
    const THREEx = g.THREE
    const cam = g.camera
    cam.updateMatrixWorld(true)
    // where is the camera actually pointing?
    const fwd = new THREEx.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
    const pitch = Math.asin(-fwd.y)                  // rad below horizontal
    const halfV = (cam.fov * Math.PI / 180) / 2
    const horizonNdc = Math.tan(pitch) / Math.tan(halfV)  // +1 = top edge
    // sky fraction, by ray
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
        // the sky dome and the fog shell are not "something in the frame"
        let real = false
        for (let k = 0; k < h.length; k++) {
          const n = h[k].object.name || ''
          if (n.indexOf('sky') >= 0 || n.indexOf('Sky') >= 0) continue
          real = true; break
        }
        if (real) hit++
      }
    }
    return { pitch: +(pitch * 180 / Math.PI).toFixed(1),
             fov: +cam.fov.toFixed(1),
             horizonNdc: +horizonNdc.toFixed(3),
             skyPct: +(100 * (1 - hit / tot)).toFixed(1),
             camY: +cam.position.y.toFixed(2),
             capyY: +g.capy.position.y.toFixed(2),
             rest: g.hud.camInfo ? (g.hud.camInfo().rest || 0) : null }
  }

  const list = ['sydney', 'pasto', 'kyoto', 'rio', 'iceland', 'sahara', 'venice',
                'kowloon', 'palawan', 'goreme', 'manly', 'pantanal', 'antarctic',
                'monaco', 'hanoi', 'quay', 'cali', 'drift', 'cave']
  for (const b of list) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(8000)          // past the arrival hold
    // WALKING: hold W and sample on the move
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(2500)
    const walk = await page.evaluate(probe)
    await page.keyboard.up('KeyW')
    // SETTLED: well past sysREST_T and the 2.5 s opening blend
    await page.waitForTimeout(9000)
    const rest = await page.evaluate(probe)
    out.rows.push({ b, cur: await page.evaluate(() => window.__capy.biome.current),
                    walk, rest })
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rd-frame.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
