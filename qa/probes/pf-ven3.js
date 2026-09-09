async page => {
  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) })
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)

  const out = await page.evaluate(async () => {
    const g = window.__capy
    const r = {}
    g.biome.switchTo('venice')
    const sp = g.biome.spawnOf('venice'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const V = g.venice
    const L = g.locals.filter(q => q.biome === 'venice')
    r.locals = L.map(q => ({ x: +q.x.toFixed(1), z: +q.z.toFixed(1), near: q.near,
      fig: !!q.fig, nLines: (q.lines || []).length,
      nWheek: (q.wheek || []).length, onTask: Object.keys(q.onTask || {}) }))
    // pair chat radius 13
    const pairs = []
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const d = Math.hypot(L[i].x - L[j].x, L[i].z - L[j].z)
      if (d < 13) pairs.push([i, j, +d.toFixed(1)])
    }
    r.chatPairs13 = pairs
    // marquee point: middle of the square, and who can see it
    const MX = V.piazza.x, MZ = V.piazza.z
    r.marqueePt = [+MX.toFixed(1), +MZ.toFixed(1)]
    r.localDistToMarquee = L.map(q => +Math.hypot(q.x - MX, q.z - MZ).toFixed(1)).sort((a, c) => a - c)
    // critters registry
    const dbg = g.hud && g.hud.calmDebug ? g.hud.calmDebug() : null
    r.critters = dbg ? dbg.critters.filter(c => c.biome === 'venice') : 'no calmDebug'
    // props
    const props = g.props.filter(p => !p.removed && !p.hidden && (!p.biome || p.biome === 'venice'))
    r.props = props.map(p => p.type)
    // audio probe: is the payout cue positional?
    r.audioProbe = (g.hud && g.hud.audioProbe) ? g.hud.audioProbe(MX, 1, MZ) : 'none'
    // wetness in the flooded square
    for (let i = 0; i < 200 * 60 && V.tide() < 0.99; i++) g.tick(1 / 60, false)
    r.tideAtHigh = +V.tide().toFixed(3)
    b.position.set(MX, V.terrainHeight(MX, MZ) + 0.6, MZ); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 180; i++) g.tick(1 / 60, false)
    r.inSquareHigh = { y: +g.capy.position.y.toFixed(2), wet: +(g.capy.wet || 0).toFixed(2),
      swim: !!g.capy.swimming, ow: V.isOverWater(MX, MZ) ? 1 : 0 }
    // now the puddle band: put the tide where terrain+0..0.22
    r.puddle = []
    for (let i = 0; i < 400 * 60; i++) {
      g.tick(1 / 60, false)
      const wy = V.tideY(), ty = V.terrainHeight(MX, MZ)
      if (wy > ty + 0.02 && wy < ty + 0.21) {
        b.position.set(MX, ty + 0.5, MZ); b.velocity.set(2, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
        for (let k = 0; k < 90; k++) g.tick(1 / 60, false)
        r.puddle.push({ wy: +wy.toFixed(3), depth: +(wy - ty).toFixed(3),
          wet: +(g.capy.wet || 0).toFixed(2), pitch: +V.surfacePitch(MX, MZ, ty).toFixed(3) })
        break
      }
    }
    return r
  })

  await page.evaluate(async (d) => {
    const bb = btoa(unescape(encodeURIComponent(JSON.stringify(d))))
    await fetch('/shot?name=venC.json', { method: 'POST', body: bb })
  }, { out, errs })
}
