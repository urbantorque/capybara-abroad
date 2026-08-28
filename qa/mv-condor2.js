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
    const res = { biome: g.biome.current }
    const th = (g.pasto && g.pasto.thermals) || []
    res.thermals = th.map(t => ({ x: +(t.x || 0).toFixed(0), z: +(t.z || 0).toFixed(0),
                                  r: +(t.r || t.radius || 0).toFixed(0),
                                  s: +(t.strength || t.v || 0).toFixed(1) }))

    g.condor.summon()
    let reach = false
    for (let s = 0; s < 60 && !reach; s++) {
      T(60)
      if (s === 6 || s === 14) g.condor.summon()
      reach = g.condor.talonInReach()
    }
    if (!reach) { res.fail = 'never in reach'; return res }
    sact = true; sactEdge = true; T(4); sact = false; T(30)
    res.mounted = !!g.condor.mounted
    if (!res.mounted) { res.fail = 'did not board'; return res }

    // HOLD ONE HEADING toward the nearest thermal, which is what a player does.
    const cb = g.condor.body
    let tgt = th[0] || { x: 0, z: -160 }
    let bd = 1e9
    for (const t of th) {
      const d = Math.hypot(t.x - b.position.x, t.z - b.position.z)
      if (d < bd) { bd = d; tgt = t }
    }
    res.target = { x: +tgt.x.toFixed(0), z: +tgt.z.toFixed(0), d0: +bd.toFixed(0) }

    const fl = []
    const y0 = b.position.y
    let maxY = y0
    for (let s = 0; s < 80; s++) {
      // stick held at the target bearing, re-aimed each sample (a player would)
      const dx = tgt.x - b.position.x, dz = tgt.z - b.position.z
      const m = Math.hypot(dx, dz) || 1
      sx = dx / m; sz = dz / m
      T(45)
      fl.push({ t: +(s * 0.75).toFixed(1), y: +b.position.y.toFixed(1),
                v: +Math.hypot(cb.velocity.x, cb.velocity.z).toFixed(1),
                vy: +cb.velocity.y.toFixed(2),
                dt: +Math.hypot(tgt.x - b.position.x, tgt.z - b.position.z).toFixed(0),
                m: !!g.condor.mounted })
      maxY = Math.max(maxY, b.position.y)
      if (!g.condor.mounted) break
    }
    res.y0 = +y0.toFixed(1); res.maxY = +maxY.toFixed(1)
    res.gain = +(maxY - y0).toFixed(1)
    res.dur = +(fl.length * 0.75).toFixed(1)
    res.endMounted = !!g.condor.mounted
    res.flight = fl
    return res
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=mv-condor2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
