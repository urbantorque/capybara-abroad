async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1000, height: 620 })
  await page.reload({ timeout: 90000 })
  await page.waitForTimeout(6000)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)

  const CASES = [
    { ch: 'kyoto', tag: 'uji-bank', x: -26, z: 116, walk: true },
    { ch: 'pasto', tag: 'plaza-box', x: 0, z: 44, y: 0.95, walk: true }
  ]

  const SAMPLE = (n) => {
    const g = window.__capy, CANNON = g.CANNON
    const capy = g.capy, b = capy.body
    const nm = g.biome.current
    const api = nm === 'sydney' ? g.env : g[nm]
    const res = new CANNON.RaycastResult()
    const rows = []
    for (let i = 0; i < n; i++) {
      g.tick(1 / 60, false)
      // contact-derived: an upward normal against anything, and against a STATIC body
      let up = 0, upStatic = 0, upKin = 0
      for (const c of g.world.contacts) {
        let other = null, isUp = false
        if (c.bi === b) { isUp = -c.ni.y > 0.4; other = c.bj }
        else if (c.bj === b) { isUp = c.ni.y > 0.4; other = c.bi }
        else continue
        if (!isUp) continue
        up++
        if (other.type === CANNON.Body.STATIC || other.mass === 0) upStatic++
        if (other.type === CANNON.Body.KINEMATIC) upKin++
      }
      // the real floor under the body, by physics ray from just under the centre
      res.reset()
      g.world.raycastClosest(new CANNON.Vec3(b.position.x, b.position.y + 0.05, b.position.z),
                             new CANNON.Vec3(b.position.x, b.position.y - 6, b.position.z), {}, res)
      const floor = res.hasHit ? res.hitPointWorld.y : null
      const law = api && api.terrainHeight ? api.terrainHeight(b.position.x, b.position.z) : 0
      rows.push({
        i, y: +b.position.y.toFixed(3),
        law: +law.toFixed(3),
        gapLaw: +(law + 0.34 - b.position.y).toFixed(3),
        floor: floor === null ? null : +floor.toFixed(3),
        gapFloor: floor === null ? null : +(floor + 0.34 - b.position.y).toFixed(3),
        up, upStatic, upKin,
        gr: !!capy.grounded, vy: +b.velocity.y.toFixed(2)
      })
    }
    return rows
  }

  const out = { at: new Date().toISOString(), cases: [] }
  for (const C of CASES) {
    const row = { ch: C.ch, tag: C.tag }
    try {
      await page.evaluate((nm) => { const g = window.__capy; if (g.biome.current !== nm) g.biome.switchTo(nm) }, C.ch)
      await page.waitForTimeout(4500)
      await page.evaluate((c) => {
        const g = window.__capy
        const nm = g.biome.current
        const api = nm === 'sydney' ? g.env : g[nm]
        const h = api && api.terrainHeight ? api.terrainHeight(c.x, c.z) : 0
        const b = g.capy.body
        b.position.set(c.x, c.y !== undefined ? c.y : (h === h ? h : 0) + 0.5, c.z)
        b.velocity.set(0, 0, 0)
        b.previousPosition.copy(b.position)
        b.interpolatedPosition.copy(b.position)
      }, C)
      await page.waitForTimeout(1200)
      if (C.walk) await page.keyboard.down('KeyW')
      row.rows = await page.evaluate(SAMPLE, 150)
      if (C.walk) await page.keyboard.up('KeyW')
    } catch (e) { row.error = String(e).slice(0, 250) }
    out.cases.push(row)
  }
  await page.evaluate(o => fetch('/shot?name=px-stuck.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))
  }), out)
}
