async page => {
  // ---------------------------------------------------------------------------
  // qa/marq-frame.js — LOOK AT ALL NINETEEN MARQUEE POINTS (ROADMAP-FUN, B1)
  //
  // The nineteen `marquee:` points are a composition, and a composition is only
  // ever judged by eye. This puts the lens on each one from where the player is
  // standing on arrival and writes a PNG. It is not the glimpse (that is 1a and
  // B2's job): the shot is asked for with `over: true` and a long hold so the
  // frame is stable when the shutter goes, which the real arrival dolly will
  // not be.
  //
  // The trap this exists to catch is the one the third-pass memories are full
  // of: a point that is correct in the table and behind a hill in the world.
  // ---------------------------------------------------------------------------
  const ORDER = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit0')
  await page.waitForTimeout(7000)

  const rows = []
  for (const b of ORDER) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(6500)
    const r = await page.evaluate(() => {
      const g = window.__capy
      const m = g.marqueePoint()
      if (!m) return { biome: g.biome.current, point: null }
      const c = g.capy.position
      const dx = c.x - m.x, dz = c.z - m.z
      const d = Math.hypot(dx, dz)
      // `yaw` is the animal->camera bearing, so the camera goes on the far side
      // of the animal from the point and the point ends up centre frame. This
      // is boardOpen's arithmetic and it is the only one in this file that has
      // ever been got backwards.
      const rise = m.y - (c.y + 1.0)
      g.frameShot({
        yaw: Math.atan2(dx / d, dz / d),
        dist: Math.min(Math.max(9, d * 0.14), 26),
        // Look UP at a thing that is above you: the play rig is 41 degrees down
        // and at that angle a landmark 60 m off is off the top of the screen.
        pitch: Math.atan2(rise, d) * -0.85 + 0.10,
        raise: Math.max(1.6, Math.min(rise * 0.45, 14)),
        hold: 6, over: true
      })
      return { biome: g.biome.current, point: m, dist: +d.toFixed(1), rise: +rise.toFixed(1) }
    })
    await page.waitForTimeout(1800)
    const seen = await page.evaluate(() => {
      const g = window.__capy
      const THREE = g.THREE
      const m = g.marqueePoint()
      if (!m) return null
      const p = new THREE.Vector3(m.x, m.y, m.z)
      const ndc = p.clone().project(g.camera)
      function drawn(o) { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true }
      const cam = g.camera.position
      const dir = p.clone().sub(cam)
      const len = dir.length()
      dir.normalize()
      const rc = new THREE.Raycaster(cam.clone(), dir, 0.6, len - 1.5)
      let blocked = ''
      try {
        const hits = rc.intersectObjects(g.scene.children, true)
        for (let i = 0; i < hits.length; i++) {
          const o = hits[i].object
          if (!o.isMesh || !o.material || !drawn(o)) continue
          if (o.material.transparent && o.material.opacity < 0.5) continue
          const bs = o.geometry && o.geometry.boundingSphere
          if (bs && bs.radius > 400) continue
          blocked = (o.name || o.type) + '@' + hits[i].distance.toFixed(0)
          break
        }
      } catch (e) { blocked = 'THREW' }
      return { ndc: { x: +ndc.x.toFixed(3), y: +ndc.y.toFixed(3), z: +ndc.z.toFixed(4) },
               inFrame: Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z > -1 && ndc.z < 1,
               blocked: blocked, framing: +g.framing().toFixed(2) }
    })
    rows.push(Object.assign(r, seen || {}))
    await page.screenshot({ path: 'qa/MF-' + b + '.png' })
  }

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=marq-frame.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs })
}
