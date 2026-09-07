async page => {
  // ---------------------------------------------------------------------------
  // qa/put-in.js — HOLD E TO PUT IT IN (ROADMAP-FUN, item 4a)
  //
  // Four things, and the fourth is the one that could quietly break the game:
  //
  //   1. hold  -> the thing is in the bin, riding it
  //   2. the bin moves -> the thing moves with it (this is what "a prop placed
  //      in another travels with it" has to mean, given that every collider in
  //      props.js is a SOLID box and nothing can be inside anything)
  //   3. tip the bin -> the thing comes out
  //   4. tap        -> a throw, with the same release velocity it had before,
  //      both next to a vessel and away from one. The action key is read at
  //      about thirty call sites and a tap/hold split that deferred every press
  //      would move all of them.
  //
  // The animal is teleported and the keys are real: a put-down is a 0.35 s hold
  // and page.keyboard.down/up is the only thing that produces one honestly.
  // ---------------------------------------------------------------------------
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)

  // Park the animal beside the nearest vessel and put `type` in its mouth.
  async function setup(type, beside) {
    return page.evaluate((arg) => {
      const g = window.__capy
      const live = g.biome.current
      const cp = g.capy.position
      let v = null, bd = 1e9
      for (const q of (g.props || [])) {
        if (!q || q.biome !== live || !q.body || !q.body.world) continue
        if (q.removed || q.hidden || q.contents) continue
        const d = g.physics.typeOf(q.type)
        if (!d || !d.vessel) continue
        const dd = Math.hypot(q.body.position.x - cp.x, q.body.position.z - cp.z)
        if (dd < bd) { bd = dd; v = q }
      }
      if (!v) return { err: 'no vessel' }
      const vb = v.body.position
      // 0.8 m out when we want to be in reach (physPUT_R is 1.2), 6 m out when
      // the point is to prove the throw is untouched away from one.
      const off = arg.beside ? 0.8 : 6.0
      // 1.1 m up, and the caller waits: a teleport that lands the animal inside
      // the paving drops it, and a falling animal is not STATIONARY — which is
      // the arming test. The first cut pressed the key on the frame after the
      // teleport and read a plain throw in two of three chapters, which looks
      // exactly like a put-down that does not work.
      g.capy.body.position.set(vb.x + off, vb.y + 1.1, vb.z)
      g.capy.body.velocity.set(0, 0, 0)
      const pr = g.physics.spawnProp(arg.type, vb.x + off, vb.z + 0.2, vb.y + 0.4)
      if (!pr) return { err: 'no prop' }
      if (!g.physics.grab(pr)) return { err: 'grab refused' }
      window.__v = v; window.__p = pr
      // The release velocity, sampled ON the drop rather than 300 ms later,
      // when gravity and the pavement have already had it.
      window.__rel = null
      if (!window.__relHooked) {
        window.__relHooked = true
        g.events.on('capy:drop', (e) => {
          const q = e && e.prop
          if (!q) return
          window.__rel = +Math.hypot(q.body.velocity.x, q.body.velocity.y,
                                     q.body.velocity.z).toFixed(3)
        })
      }
      return { vessel: v.type, dist: +off.toFixed(2), held: !!g.capy.heldProp,
               vesselAt: +bd.toFixed(1) }
    }, { type: type, beside: beside })
  }

  const rows = []
  for (const b of ['sydney', 'venice', 'hanoi']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(11000)
    const row = { b: b }

    // ---- 1. the hold ------------------------------------------------------
    row.setup = await setup('hat', true)
    if (!row.setup.err) {
      await page.waitForTimeout(2000)   // land, and stop moving
      // ...AND THEN PUT IT BACK. In Hanoi the animal slid 1.0 m down the road
      // during the settle and ended 1.84 m from the bin, which is outside
      // physPUT_R — so the arm never happened and it read as a put-down that
      // does not work in that chapter. Settle first (so the animal is
      // stationary, which is half the arming test), THEN square it up.
      row.setup.stillAt = await page.evaluate(() => {
        const g = window.__capy, v = window.__v
        const b = v.body.position
        g.capy.body.position.set(b.x + 0.8, g.capy.body.position.y, b.z)
        g.capy.body.velocity.set(0, 0, 0)
        g.capy.body.previousPosition.copy(g.capy.body.position)
        g.capy.body.interpolatedPosition.copy(g.capy.body.position)
        const vv = g.capy.velocity
        return +Math.hypot(vv.x, vv.z).toFixed(2)
      })
      await page.waitForTimeout(250)
      // ...and once more immediately before the press. In Hanoi the animal
      // drifted from 0.80 m to 1.21 m in the quarter second between the two,
      // which is outside physPUT_R by a centimetre.
      await page.evaluate(() => {
        const g = window.__capy, v = window.__v
        const b = v.body.position
        g.capy.body.position.set(b.x + 0.8, g.capy.body.position.y, b.z)
        g.capy.body.velocity.set(0, 0, 0)
        g.capy.body.previousPosition.copy(g.capy.body.position)
        g.capy.body.interpolatedPosition.copy(g.capy.body.position)
      })
      // ...and then wait, because a teleport IS motion: half the arming test is
      // "while stationary", and a 0.4 m correction in one frame reads as tens
      // of metres per second until the next few frames have gone by.
      // ---- PIN IT ---------------------------------------------------
      // Three chapters, three different ways the animal would not stay put:
      // it slid a metre down a Hanoi road, it drifted out of physPUT_R on a
      // Venetian quay between two samples, and in one run it lost the prop
      // out of its mouth before the key went down. A put-down is a 0.35 s
      // hold and the probe has to be able to guarantee 0.35 s of standing
      // still — so the body is rewritten twenty times a second for the
      // length of the test. The arming test wants a stationary animal and
      // this is the honest way to hand it one.
      await page.evaluate(() => {
        const g = window.__capy, v = window.__v
        const b = { x: v.body.position.x, y: v.body.position.y, z: v.body.position.z }
        window.__pin = setInterval(() => {
          const cb = g.capy.body
          cb.position.set(b.x + 0.8, cb.position.y, b.z)
          cb.velocity.set(0, 0, 0)
          cb.previousPosition.copy(cb.position)
          cb.interpolatedPosition.copy(cb.position)
        }, 50)
      })
      await page.waitForTimeout(400)
      // WHY, if it does not arm. vesselNear is the arming test and it has
      // four ways to say no; a probe that only reports 'it did not happen'
      // costs a rebuild to find out which.
      row.arm = await page.evaluate(() => {
        const g = window.__capy, v = window.__v
        const cp = g.capy.position
        const got = g.physics.vesselNear(cp, undefined, g.capy.heldProp)
        return { found: !!got, sameAsPicked: got === v,
                 d: +Math.hypot(v.body.position.x - cp.x, v.body.position.z - cp.z).toFixed(2),
                 capyY: +cp.y.toFixed(2),
                 speed: +Math.hypot(g.capy.velocity.x, g.capy.velocity.z).toFixed(2),
                 mouthY: +(v.body.position.y + v.originY).toFixed(2),
                 contents: !!v.contents, held: !!v.held, hidden: !!v.hidden,
                 vBiome: v.biome, live: g.biome.current,
                 // capybara.js defers the whole action key when the condor's
                 // talons are in reach — see the comment at the dispatch.
                 talons: !!(g.condor && typeof g.condor.talonInReach === 'function' &&
                            g.condor.talonInReach()),
                 heldNow: !!g.capy.heldProp,
                 audit0: g.capy.putAudit ? g.capy.putAudit() : null }
      })
      // ...AND MAKE SURE IT IS STILL IN THE MOUTH. In two chapters of three
      // the hat was gone by the time the key went down — the ownership walk
      // is chapter-neutral and a prop spawned beside a local belongs to that
      // local, who comes and takes it back. That is the game working; it is
      // not the thing under test.
      row.regrab = await page.evaluate(() => {
        const g = window.__capy
        if (g.capy.heldProp) return 'already'
        const p = window.__p
        p.owner = null; p.hidden = false; p.grabbable = true
        return g.physics.grab(p) ? 'regrabbed' : 'FAILED'
      })
      await page.keyboard.down('KeyE')
      await page.waitForTimeout(700)
      await page.keyboard.up('KeyE')
      await page.waitForTimeout(400)
      await page.evaluate(() => { clearInterval(window.__pin) })
      await page.waitForTimeout(200)
      row.put = await page.evaluate(() => {
        const p = window.__p, v = window.__v
        const a = window.__capy.capy.putAudit ? window.__capy.capy.putAudit() : null
        return { inVessel: !!p.inVessel, contents: v.contents === p, audit: a,
                 held: !!window.__capy.capy.heldProp,
                 kin: p.body.type === 4 || p.body.type === 2,
                 dy: +(p.body.position.y - v.body.position.y).toFixed(2) }
      })
      // ---- 2. it travels with it ------------------------------------------
      row.ride = await page.evaluate(async () => {
        const p = window.__p, v = window.__v
        // MOVE THE VESSEL, do not ask it to move. The first cut pushed the
        // bin with a velocity and read vesselMoved 0.01: a 9 kg box asleep on
        // paving does not accept a shove from a probe, and a ride test whose
        // vessel did not move proves nothing either way.
        const before = { x: p.body.position.x, z: p.body.position.z }
        v.body.wakeUp()
        v.body.position.x += 3.0; v.body.position.z += 2.0
        v.body.previousPosition.copy(v.body.position)
        v.body.interpolatedPosition.copy(v.body.position)
        await new Promise(r => setTimeout(r, 400))
        const dv = Math.hypot(v.body.position.x - before.x, v.body.position.z - before.z)
        const dp = Math.hypot(p.body.position.x - before.x, p.body.position.z - before.z)
        const gap = Math.hypot(p.body.position.x - v.body.position.x,
                               p.body.position.z - v.body.position.z)
        return { vesselMoved: +dv.toFixed(2), contentsMoved: +dp.toFixed(2),
                 gap: +gap.toFixed(3), still: v.contents === p }
      })
      // ---- 3. tip it ------------------------------------------------------
      row.tip = await page.evaluate(async () => {
        const p = window.__p, v = window.__v
        // ...and the same for the tip: physPUT_TIP is 0.62 rad, so lean it
        // to 1.2 and let the next frame read it.
        v.body.wakeUp()
        v.body.quaternion.setFromAxisAngle({ x: 1, y: 0, z: 0 }, 1.2)
        for (let i = 0; i < 40; i++) {
          await new Promise(r => setTimeout(r, 60))
          if (!p.inVessel) break
        }
        return { out: !p.inVessel, contents: v.contents === p,
                 dyn: p.body.type === 1 }
      })
    }

    // ---- 4. the tap, next to a vessel and away from one --------------------
    for (const beside of [true, false]) {
      const s = await setup('hat', beside)
      if (s.err) { row['tap' + beside] = s; continue }
      await page.waitForTimeout(2000)
      const t0 = await page.evaluate(() => window.__capy.state.time)
      await page.keyboard.down('KeyE')
      await page.waitForTimeout(70)          // a click, not a hold
      await page.keyboard.up('KeyE')
      await page.waitForTimeout(300)
      row['tap' + beside] = await page.evaluate((arg) => {
        const g = window.__capy, p = window.__p
        return { threw: !g.capy.heldProp && !p.inVessel,
                 // the impulse is mass-proportional, so speed is the thing that
                 // has to be the same on both sides of this pair
                 v: window.__rel,
                 lag: +(g.capy.threwAt - arg.t0).toFixed(2) }
      }, { t0: t0 })
    }
    rows.push(row)
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=put-in.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs })
}
