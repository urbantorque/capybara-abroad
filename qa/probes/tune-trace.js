async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(3000)

  const out = await page.evaluate(() => {
    const g = window.__capy
    const b = g.capy.body, inp = g.input, D = 1 / 60
    let sx = 0, sz = 0, srun = false, sjump = false, sedge = false
    function T (k) {
      for (let i = 0; i < k; i++) {
        inp.x = sx; inp.z = sz; inp.run = srun; inp.camYaw = 0
        inp.jump = sjump; inp.jumpPressed = sedge; sedge = false
        g.tick(D, false)
      }
    }
    const sp = g.biome.spawnOf('sydney')
    function place (x, z) {
      b.position.set(x, 0.5, z); b.velocity.set(0, 0, 0)
      b.angularVelocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }
    function sp2 () { return Math.hypot(b.velocity.x, b.velocity.z) }

    // Run down the +x lawn, which is open in Sydney, rather than into the pond.
    function trial (run, holdAir) {
      place(sp.x - 40, sp.z); sx = 0; sz = 0; srun = run; sjump = false; T(90)
      sx = 1; T(180)
      const vIn = sp2()
      const x0 = b.position.x, z0 = b.position.z, y0 = b.position.y
      sjump = true; sedge = true
      const trace = []
      let apex = 0, air = 0, left = false
      for (let i = 0; i < 240; i++) {
        if (!holdAir && left) { sx = 0; srun = false }
        T(1)
        apex = Math.max(apex, b.position.y - y0)
        if (!g.capy.grounded) { left = true; air += D }
        else if (left && i > 10) break
        if (i % 5 === 0) trace.push(+sp2().toFixed(2))
      }
      sjump = false; sx = 0; srun = false
      const dist = Math.hypot(b.position.x - x0, b.position.z - z0)
      T(40)
      return { vIn: +vIn.toFixed(2), dist: +dist.toFixed(2),
               apex: +apex.toFixed(2), air: +air.toFixed(3),
               vTrace: trace.slice(0, 12) }
    }
    return {
      walkHold: trial(false, true),
      runHold:  trial(true, true),
      runLetGo: trial(true, false)
    }
  })

  await page.evaluate(o => fetch('/shot?name=trace.json', {
    method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1))))
  }), out)
}
