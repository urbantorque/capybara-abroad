async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.keyboard.press('Digit2')
  await page.waitForTimeout(6000)

  const out = await page.evaluate(() => {
    const g = window.__capy
    const inp = g.input
    const D = 1 / 60
    const b = g.capy.body
    let sx = 0, sz = 0, sact = false, sactEdge = false
    function T (k) {
      for (let i = 0; i < k; i++) {
        inp.x = sx; inp.z = sz; inp.run = false; inp.camYaw = 0
        inp.action = sact; inp.actionPressed = sactEdge; sactEdge = false
        inp.honk = false; inp.whistle = false
        g.tick(D, false)
      }
    }
    const res = { biome: g.biome.current, trace: [] }
    res.summon1 = g.condor.summon()
    let tReach = -1
    for (let s = 0; s < 60; s++) {           // 60 s
      T(60)
      const cb = g.condor.body
      res.trace.push({ t: s + 1, st: g.condor.state,
                       dy: cb ? +(cb.position.y - b.position.y).toFixed(1) : null,
                       d: cb ? +Math.hypot(cb.position.x - b.position.x, cb.position.z - b.position.z).toFixed(1) : null,
                       reach: g.condor.talonInReach() })
      if (s === 6 || s === 14) g.condor.summon()   // whistle again to bring it down
      if (g.condor.talonInReach()) { tReach = s + 1; break }
    }
    res.tReach = tReach
    res.state = g.condor.state
    if (tReach > 0) {
      sact = true; sactEdge = true; T(4); sact = false; T(30)
      res.mounted = !!g.condor.mounted
      if (res.mounted) {
        const y0 = b.position.y
        let maxY = y0
        const fl = []
        for (let s = 0; s < 50; s++) {
          const th = s * 0.3
          sx = Math.sin(th) * 0.8; sz = -Math.cos(th) * 0.8
          T(45)
          const cb = g.condor.body
          fl.push({ t: +(s * 0.75).toFixed(1), y: +b.position.y.toFixed(1),
                    v: +Math.hypot(cb.velocity.x, cb.velocity.z).toFixed(1),
                    vy: +cb.velocity.y.toFixed(2), m: !!g.condor.mounted })
          maxY = Math.max(maxY, b.position.y)
          if (!g.condor.mounted) break
        }
        res.y0 = +y0.toFixed(1); res.maxY = +maxY.toFixed(1)
        res.gain = +(maxY - y0).toFixed(1)
        res.endMounted = !!g.condor.mounted
        res.flight = fl
      }
    }
    return res
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=mv-condor.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
