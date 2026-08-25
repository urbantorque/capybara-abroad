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
    // every board knot: terrain, and would it ever be under water
    const P = V.boardPath()
    const kn = []
    for (let i = 0; i < P.length; i += 2) {
      const ty = V.terrainHeight(P[i], P[i + 1])
      kn.push({ x: +P[i].toFixed(1), z: +P[i + 1].toFixed(1), ty: +ty.toFixed(2),
        floodsAt: +(ty + 0.22).toFixed(2), everFloods: (ty + 0.22) <= 0.95 ? 1 : 0 })
    }
    r.knots = kn
    r.knotsThatFlood = kn.filter(k => k.everFloods).length
    r.nKnots = kn.length
    // wheek pools, real field name
    const L = g.locals.filter(q => q.biome === 'venice')
    r.wheek = L.map(q => ({ x: +q.x.toFixed(0), z: +q.z.toFixed(0),
      wl: (q.wheekLines || []).length, ln: (q.lines || []).length, cool: q.cool }))
    // fresh wetness in the puddle band, never having swum
    for (let i = 0; i < 400 * 60; i++) {
      g.tick(1 / 60, false)
      const wy = V.tideY(), ty = V.terrainHeight(-4, -35)
      if (wy > ty + 0.10 && wy < ty + 0.21) {
        b.position.set(-4, ty + 0.5, -35); b.velocity.set(0, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
        for (let k = 0; k < 150; k++) g.tick(1 / 60, false)
        r.freshPuddle = { depth: +(wy - ty).toFixed(3), wet: +(g.capy.wet || 0).toFixed(3),
          swim: !!g.capy.swimming, pitch: +V.surfacePitch(-4, -35, ty).toFixed(3) }
        break
      }
    }
    return r
  })

  await page.evaluate(async (d) => {
    const bb = btoa(unescape(encodeURIComponent(JSON.stringify(d))))
    await fetch('/shot?name=venE.json', { method: 'POST', body: bb })
  }, { out, errs })
}
