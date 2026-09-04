async page => {
  const out = { errs: [], rows: [] }
  page.on('pageerror', e => out.errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload({ timeout: 90000 })
  await page.waitForTimeout(6500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(3000)
  await page.evaluate(() => { const g = window.__capy; if (!g.biome.isActive('goreme')) g.biome.switchTo('goreme') })
  await page.waitForTimeout(4200)

  const R = () => {
    const g = window.__capy, CANNON = g.CANNON, b = g.capy.body, inp = g.input
    const api = g.goreme
    const th = (x, z) => (api && api.terrainHeight) ? api.terrainHeight(x, z) : 0
    const T = (k, sx, sz) => {
      for (let i = 0; i < k; i++) {
        inp.x = sx || 0; inp.z = sz || 0; inp.run = false; inp.camYaw = 0
        inp.jump = false; inp.jumpPressed = false
        g.tick(1 / 60, false)
      }
    }
    // DROP AND SETTLE, not terrainHeight + 0.34 - fault 5 from the walk rig.
    const place = (x, z) => {
      b.position.set(x, th(x, z) + 3.0, z)
      b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      T(70)
    }
    const rows = []
    // the five crews, from gorBuildField
    const crews = [[-19, 12], [-5, 14], [12, 11], [20, -4], [-21, -6]]
    // Walk at each crew's ORIGIN from 6 m out on +x. The baskets sit at various
    // offsets around it, so this is a sweep of the kit rather than a point test.
    for (const [cx, cz] of crews) {
      for (const [ux, uz, tag] of [[1, 0, '+x'], [0, 1, '+z']]) {
        const sx = cx - ux * 7, sz = cz - uz * 7
        place(sx, sz)
        const x0 = b.position.x, z0 = b.position.z
        let maxAlong = 0
        for (let i = 0; i < 170; i++) {
          T(1, ux, uz)
          const a = (b.position.x - x0) * ux + (b.position.z - z0) * uz
          if (a > maxAlong) maxAlong = a
        }
        T(10, 0, 0)
        rows.push({ crew: [cx, cz], dir: tag, from: [+sx.toFixed(1), +sz.toFixed(1)],
                    along: +maxAlong.toFixed(2),
                    blocked: maxAlong < 6.4 })
      }
    }
    // ...and the mouth must still be enterable: crew 2 is state 1 at (-5,14).
    // Its throat is at cr - sin/cos(ry)*5, ry unknown from outside, so just try
    // to reach the crew centre from every side and report the best approach.
    let bestIn = 99
    for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      place(-5 - ux * 8, 14 - uz * 8)
      for (let i = 0; i < 190; i++) T(1, ux, uz)
      const d = Math.hypot(b.position.x - (-5), b.position.z - 14)
      if (d < bestIn) bestIn = d
    }
    rows.push({ crew: 'mouth (-5,14)', closestApproach: +bestIn.toFixed(2) })
    return rows
  }

  try { out.rows = await page.evaluate(R) } catch (e) { out.fatal = String(e).slice(0, 250) }
  await page.evaluate(o => fetch('/shot?name=px-x5-gor.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))
  }), out)
}
