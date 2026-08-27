async page => {
  const ALL = ['sydney','pasto','kyoto','cali','rio','venice','kowloon','sahara','monaco']
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(3000)

  const rows = []
  for (const name of ALL) {
    rows.push(await page.evaluate((n) => {
      const g = window.__capy
      if (!g.biome.isActive(n)) g.biome.switchTo(n)
      const inp = g.input
      const D = 1 / 60
      const b = g.capy.body
      for (let i = 0; i < 60; i++) g.tick(D, false)

      // A CONTROLLED BARGE. Line the animal up six metres from a loose prop,
      // drive straight at it, and measure how far the prop ends up from where
      // it started. Once at a walk and once at a run, from the SAME start, so
      // the number that matters is the difference between them.
      const props = (g.props || []).filter(p => p && p.body && p.body.mass > 0.5 &&
                                                !p.held && !p.frozen && !p.hidden &&
                                                (!p.biome || p.biome === n))
      function trial (p, run) {
        const px = p.body.position.x, py = p.body.position.y, pz = p.body.position.z
        p.body.position.set(px, py, pz)
        p.body.velocity.set(0, 0, 0); p.body.angularVelocity.set(0, 0, 0)
        p.body.previousPosition.copy(p.body.position)
        p.body.interpolatedPosition.copy(p.body.position)
        // come at it from the direction the animal already is, six metres out
        let dx = px - b.position.x, dz = pz - b.position.z
        const d = Math.hypot(dx, dz) || 1
        dx /= d; dz /= d
        b.position.set(px - dx * 6, py + 0.2, pz - dz * 6)
        b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
        for (let i = 0; i < 30; i++) {
          inp.x = 0; inp.z = 0; inp.run = false; inp.camYaw = 0
          inp.jump = false; inp.jumpPressed = false; inp.action = false
          g.tick(D, false)
        }
        const x0 = p.body.position.x, z0 = p.body.position.z
        let hitSpeed = 0
        for (let i = 0; i < 180; i++) {
          inp.x = dx; inp.z = dz; inp.run = run; inp.camYaw = 0
          inp.jump = false; inp.jumpPressed = false; inp.action = false
          g.tick(D, false)
          const s = Math.hypot(b.velocity.x, b.velocity.z)
          if (s > hitSpeed) hitSpeed = s
        }
        return { moved: +Math.hypot(p.body.position.x - x0, p.body.position.z - z0).toFixed(2),
                 v: +hitSpeed.toFixed(1) }
      }
      const out = { biome: g.biome.current, props: props.length, trials: [] }
      for (let i = 0; i < props.length && out.trials.length < 3; i += Math.max(1, (props.length / 5) | 0)) {
        const p = props[i]
        const w = trial(p, false)
        const r = trial(p, true)
        out.trials.push({ type: p.type || '?', mass: +(p.body.mass).toFixed(1),
                          walk: w.moved, run: r.moved, vw: w.v, vr: r.v })
      }
      inp.x = 0; inp.z = 0; inp.run = false
      for (let i = 0; i < 30; i++) g.tick(D, false)
      return out
    }, name))
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=mv-barge.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, rows)
}
