async page => {
  const ALL = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
               'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic',
               'monaco','hanoi']
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
      const sp = g.biome.spawnOf(n)
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 60; i++) g.tick(D, false)

      // IS THE NEW FEEDBACK NOISE? Wrap the two channels and drive the animal
      // the way a player does — sprinting, turning every second or so, never
      // deliberately aiming at a wall. A wall bonk that fires more than a
      // handful of times a minute is not a bonk, it is a rattle.
      let punches = 0, thuds = 0, skids = 0, sumP = 0
      const rawP = g.punch, rawS = g.sfx
      g.punch = function (a) { punches++; sumP += a; return rawP.call(g, a) }
      g.sfx = function (nm, o) {
        if (nm === 'thud') thuds++
        if (nm === 'rustle' && o && o.pitch === 1.5) skids++
        return rawS.call(g, nm, o)
      }
      // a deterministic wander: no rand(), so this is repeatable
      let seed = 12345
      const nx = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
      const SECS = 45
      for (let s = 0; s < SECS; s++) {
        const th = nx() * Math.PI * 2
        const sx = Math.sin(th), sz = Math.cos(th)
        const run = nx() > 0.25
        const hold = nx() > 0.75          // a quarter of the time, stop and stand
        for (let i = 0; i < 60; i++) {
          inp.x = hold ? 0 : sx; inp.z = hold ? 0 : sz
          inp.run = run && !hold; inp.camYaw = 0
          inp.action = false; inp.actionPressed = false
          inp.jump = false; inp.jumpPressed = false
          g.tick(D, false)
        }
      }
      g.punch = rawP; g.sfx = rawS
      inp.x = 0; inp.z = 0; inp.run = false
      for (let i = 0; i < 30; i++) g.tick(D, false)
      return { biome: g.biome.current, secs: SECS,
               punches: punches, perMin: +(punches * 60 / SECS).toFixed(1),
               meanA: punches ? +(sumP / punches).toFixed(3) : 0,
               thuds: thuds, skids: skids }
    }, name))
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=mv-noise.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, rows)
}
