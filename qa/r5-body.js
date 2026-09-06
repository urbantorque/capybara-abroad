async page => {
  // R5. THREE CHANNELS THAT CANNOT BE READ OFF A SCREENSHOT.
  //
  // A breath is 1% of an animal, a settle is 0.06 rad and lasts a third of a
  // second, and a tail flick is one centimetre. None of the three can be judged
  // from a still, so every one of them is measured as a TRACE over time and the
  // amplitude is quoted in millimetres of the drawn animal, not in the units of
  // the constant that drives it.
  //
  //  1. animAudit gains breath / tail / headNod. Assert they exist, and that
  //     the first two are alive at rest and dead in the air.
  //  2. THE BREATH IN MILLIMETRES. Track the world y of the highest vertex of
  //     the hull, frame by frame, and report peak to peak. That is the number a
  //     player can or cannot see, and it is comparable across builds even
  //     though R5 moved the term from the hull's node to the body's.
  //  3. THE SETTLE ARRIVES AFTER THE SPRING. Hop, sample capyLand and headNod
  //     together, and report the frame each of them peaks on. "After the
  //     landing spring bottoms out" is a claim about ORDER and this is the only
  //     way to check it.
  //  4. THE FLICK. Wheek, and trace the tail.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)

  // The tracker: one vertex of the hull, the highest one in its own frame,
  // followed in world space. Installed once and drained by the samplers below.
  const setup = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    let hull = null
    g.capy.group.traverse(o => { if (o.name === 'capyHull') hull = o })
    if (!hull) return { err: 'no capyHull' }
    const p = hull.geometry.attributes.position
    let bi = 0, by = -9
    for (let i = 0; i < p.count; i++) if (p.getY(i) > by) { by = p.getY(i); bi = i }
    window.__r5 = {
      hull, bi,
      v: new T.Vector3(),
      top() {
        this.hull.updateWorldMatrix(true, false)
        this.v.fromBufferAttribute(this.hull.geometry.attributes.position, this.bi)
        this.v.applyMatrix4(this.hull.matrixWorld)
        return this.v.y
      }
    }
    const a = g.capy.animAudit()
    return { err: null, localTopY: Math.round(by * 1000) / 1000,
             has: { breath: 'breath' in a, tail: 'tail' in a, headNod: 'headNod' in a } }
  })

  // sample `n` frames of whatever `pick` returns, on real rAF
  const trace = (ms) => page.evaluate(async (ms) => {
    const g = window.__capy, R = window.__r5
    const out = []
    const t0 = performance.now()
    while (performance.now() - t0 < ms) {
      const a = g.capy.animAudit()
      out.push([Math.round((performance.now() - t0)), R.top(),
                a.breath || 0, a.tail || 0, a.headNod || 0, a.land, a.pop, a.speed, a.airPose,
                g.capy.loaf])
      await new Promise(r => requestAnimationFrame(r))
    }
    return out
  }, ms)

  const stat = (rows, k) => {
    let lo = 9e9, hi = -9e9
    for (const r of rows) { if (r[k] < lo) lo = r[k]; if (r[k] > hi) hi = r[k] }
    return { lo: Math.round(lo * 100000) / 100000, hi: Math.round(hi * 100000) / 100000,
             p2p: Math.round((hi - lo) * 100000) / 100000 }
  }
  const mm = (rows) => Math.round((stat(rows, 1).p2p) * 10000) / 10        // mm, 1 dp
  // ...and the same number with EVERY OTHER CHANNEL HELD STILL. The top of the
  // back also moves with the gait bob, the pop, the landing absorb and the
  // terrain lift, and a raw peak-to-peak over nine seconds is the sum of all of
  // them. This keeps only frames where the animal is doing nothing but breathe,
  // which is the only state the breath is supposed to be visible in anyway.
  const still = (rows) => rows.filter(r => r[7] < 0.02 && Math.abs(r[6]) < 0.005 &&
                                           Math.abs(r[5]) < 0.002)
  const mmStill = (rows) => {
    const q = still(rows)
    return { n: q.length, mm: q.length > 30 ? Math.round(stat(q, 1).p2p * 10000) / 10 : null }
  }

  const out = { setup, errs }

  // ---- A. THE LOAF (rest, which after capyLOAF_T is what rest IS) ---------
  const loafRows = await trace(9000)
  out.loaf = { loaf: Math.round(loafRows[0][9] * 1000) / 1000,
               topMM: mm(loafRows), topStill: mmStill(loafRows),
               breath: stat(loafRows, 2), tail: stat(loafRows, 3),
               n: loafRows.length }

  // ---- B. STANDING. Walk, release, and sample immediately: rest IS the loaf
  // and an animal left alone sits down again inside capyLOAF_T.
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(1500)
  await page.keyboard.up('KeyW')
  const standRows = await trace(5200)
  out.stand = { loaf: Math.round(standRows[0][9] * 1000) / 1000,
                topMM: mm(standRows), topStill: mmStill(standRows),
                breath: stat(standRows, 2), tail: stat(standRows, 3),
                speed: stat(standRows, 7), n: standRows.length }

  // ---- C. WALKING: the breath has to fade out, and the old gate was a step
  await page.keyboard.down('KeyW')
  const walkRows = await trace(2600)
  await page.keyboard.up('KeyW')
  // ...at a real walking speed, not over the ramp out of a standstill: the
  // trace starts at zero and the fade is the thing being measured.
  const fast = walkRows.filter(r => r[7] > 2)
  // ...and the LAST 800 ms of it, which is the only window in which the lambda-4
  // fade has finished: a range taken over the whole walk is a range over the
  // fade itself and reads as a breath that never went away.
  const endT = walkRows.length ? walkRows[walkRows.length - 1][0] - 800 : 0
  const late = walkRows.filter(r => r[0] > endT)
  out.walk = { topMM: mm(walkRows), n: walkRows.length, nFast: fast.length,
               breath: stat(walkRows, 2),
               breathFast: fast.length ? stat(fast, 2) : null,
               breathEnd: late.length ? stat(late, 2) : null, nLate: late.length,
               tail: stat(walkRows, 3), speed: stat(walkRows, 7) }

  // ---- D. THE AIR: both channels must be zero -----------------------------
  await page.waitForTimeout(900)
  await page.keyboard.press('Space')
  const hopRows = await trace(2200)
  const air = hopRows.filter(r => r[8] > 0.9)
  out.air = { n: air.length,
              breath: air.length ? stat(air, 2) : null,
              tail: air.length ? stat(air, 3) : null }

  // ---- E. THE SETTLE, and it is a claim about ORDER ------------------------
  // Take the hop trace above: which frame does capyLand bottom out on, and
  // which frame does headNod peak on?
  let iLand = 0, iNod = 0
  for (let i = 0; i < hopRows.length; i++) {
    if (hopRows[i][5] < hopRows[iLand][5]) iLand = i
    if (Math.abs(hopRows[i][4]) > Math.abs(hopRows[iNod][4])) iNod = i
  }
  out.settle = {
    landMin: Math.round(hopRows[iLand][5] * 10000) / 10000, landAtMs: hopRows[iLand][0],
    nodMax: Math.round(hopRows[iNod][4] * 10000) / 10000, nodAtMs: hopRows[iNod][0],
    nodAfterLandMs: hopRows[iNod][0] - hopRows[iLand][0],
    nodDeg: Math.round(hopRows[iNod][4] * 180 / Math.PI * 10) / 10
  }

  // ---- F. THE FLICK -------------------------------------------------------
  await page.waitForTimeout(1800)
  await page.keyboard.press('KeyQ')
  const wheekRows = await trace(2400)
  out.wheek = { tail: stat(wheekRows, 3),
                tailDeg: Math.round(stat(wheekRows, 3).p2p * 180 / Math.PI * 10) / 10,
                pop: stat(wheekRows, 6) }

  // ...and how far the nub itself moves, in mm, which is the number that says
  // whether any of this is visible.
  out.tailArcMM = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    let piv = null
    g.capy.group.traverse(o => {
      if (o.isGroup && o.children.length === 1 && o.children[0].isMesh &&
          Math.abs(o.position.z + 0.500) < 1e-6) piv = o
    })
    if (!piv) return null
    const nub = piv.children[0]
    const a = new T.Vector3(), b = new T.Vector3()
    const was = piv.rotation.x
    piv.rotation.x = 0; piv.updateWorldMatrix(true, true)
    a.set(0, 0, 0).applyMatrix4(nub.matrixWorld)
    piv.rotation.x = 0.25; piv.updateWorldMatrix(true, true)
    b.set(0, 0, 0).applyMatrix4(nub.matrixWorld)
    piv.rotation.x = was; piv.updateWorldMatrix(true, true)
    return Math.round(a.distanceTo(b) * 10000) / 10
  })

  out.errs = errs
  await page.evaluate(async o => {
    await fetch('/shot?name=R5-body.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
