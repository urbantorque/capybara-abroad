async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => { window.__capy.biome.switchTo('antarctic') })
  await page.waitForTimeout(1500)
  await page.evaluate(() => {
    const g = window.__capy, a = g.antarctic
    const h = a.boat.helm
    g.capy.body.position.set(h.x, h.y + 0.2, h.z)
    g.capy.body.velocity.set(0, 0, 0)
  })
  await page.waitForTimeout(1200)
  await page.keyboard.press('e')
  await page.waitForTimeout(400)

  const steerTo = async (tx, tz, seconds, log, near) => {
    await page.keyboard.down('w')
    const end = Date.now() + seconds * 1000
    let ok = false
    while (Date.now() < end) {
      const st = await page.evaluate((t) => {
        const a = window.__capy.antarctic
        const bx = a.boat.position.x, bz = a.boat.position.z
        const want = Math.atan2(t[0] - bx, t[1] - bz)
        let e = want - a.boat.heading
        while (e > Math.PI) e -= Math.PI * 2
        while (e < -Math.PI) e += Math.PI * 2
        return { e, d: Math.hypot(t[0] - bx, t[1] - bz), sp: a.boat.speed, x: bx, z: bz }
      }, [tx, tz])
      if (log) log.push([+st.x.toFixed(0), +st.z.toFixed(0), +st.sp.toFixed(1), +st.d.toFixed(0)])
      if (st.d < (near || 20)) { ok = true; break }
      const key = st.e > 0.08 ? 'a' : st.e < -0.08 ? 'd' : null
      if (key) {
        const hold = Math.min(360, Math.max(60, Math.abs(st.e) * 240))
        await page.keyboard.down(key); await page.waitForTimeout(hold); await page.keyboard.up(key)
      } else { await page.waitForTimeout(180) }
    }
    await page.keyboard.up('w')
    return ok
  }

  const B = await page.evaluate(() => {
    const a = window.__capy.antarctic
    return [a.berg.x, a.berg.z]
  })
  const legA = []
  const gotSouth = await steerTo(B[0], B[1] + 42, 110, legA, 14)
  const south = await page.evaluate(() => {
    const a = window.__capy.antarctic
    return { boat: [+a.boat.position.x.toFixed(1), +a.boat.position.z.toFixed(1)] }
  })
  const legB = []
  const gotThrough = await steerTo(B[0], B[1] - 42, 70, legB, 14)
  const after = await page.evaluate(() => {
    const g = window.__capy, a = g.antarctic
    return { boat: [+a.boat.position.x.toFixed(1), +a.boat.position.z.toFixed(1)],
             arch: g.hud.isTaskDone('berg-arch'), err: g.state.lastError || null,
             saves: g.state.solverSaves || 0 }
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=antarch.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, { gotSouth, south, gotThrough, after, legA: legA.slice(-6), legB })
}
