async page => {
  // T4c: THE LENS UNDER THE COLONNADE. Fresh profile, Sydney; the animal held
  // at four spots under the arcade (the review's (-45.2, 0.3, 10.9) first),
  // the camera yaw held at four bearings each. For every pose: the eye, and
  // whether the entablature/awning band (the camSolid compound built in T4c)
  // lies between the eye and the animal — a ray from the eye to the animal's
  // back against that one body. A PNG of the review's pose.
  const PORT = 5193, NAME = 'ten-t4c-colonnade'
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  for (let i = 0; i < 160; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capy && document.querySelector('.capyui-go')))) break }
  await page.waitForTimeout(1500)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go:not(.alt)') || document.querySelector('.capyui-go'); if (b) b.click() })
  for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
  await page.waitForTimeout(3000)
  const spots = [[-45.2, 10.9], [-40.0, 10.6], [-34.5, 10.2], [-28.0, 10.5]]
  const yaws = [0, Math.PI / 2, Math.PI, -Math.PI / 2]
  const out = { poses: [] }
  for (let s = 0; s < spots.length; s++) {
    for (let y = 0; y < yaws.length; y++) {
      const r = await page.evaluate(async ({ x, z, yaw }) => {
        const g = window.__capy, C = g.world.bodies.find(b => b.userData && b.userData.camSolid && b.shapes.length > 4)
        const hold = setInterval(() => {
          const b = g.capy.body
          b.position.set(x, 0.6, z); b.velocity.set(0, 0, 0)
          b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
          g.input.camYaw = yaw
        }, 30)
        await new Promise(r => setTimeout(r, 1600))
        clearInterval(hold)
        const e = g.camera.position, p = g.capy.position
        // does the band lie between the eye and the animal's back?
        let hit = false
        if (C) {
          g.world.raycastAll({ x: e.x, y: e.y, z: e.z }, { x: p.x, y: p.y + 0.5, z: p.z }, {}, rr => { if (rr.body === C) hit = true })
        }
        return { spot: [x, z], yaw: +yaw.toFixed(2), eye: [e.x, e.y, e.z].map(v => +v.toFixed(2)), capy: [p.x, p.y, p.z].map(v => +v.toFixed(2)),
                 dist: +Math.hypot(e.x - p.x, e.y - p.y, e.z - p.z).toFixed(2), bandBetween: hit, compound: !!C }
      }, { x: spots[s][0], z: spots[s][1], yaw: yaws[y] })
      out.poses.push(r)
      if (s === 0 && y === 0) await page.screenshot({ path: 'qa/' + NAME + '-a.png', timeout: 90000 })
      if (s === 2 && y === 2) await page.screenshot({ path: 'qa/' + NAME + '-b.png', timeout: 90000 })
    }
  }
  out.between = out.poses.filter(p => p.bandBetween).length
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { name: NAME, out })
}
