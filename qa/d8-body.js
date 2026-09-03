async page => {
  // THE BODY, SECOND HALF — the five channels D8 adds, every one of which is
  // invisible in a still frame.
  //
  //  1. THE CLIMB. A climb pose and an air tuck are the same silhouette for the
  //     first tenth of a second, and `capyClingT` had never been read at all —
  //     so the test is that the legs go somewhere the tuck cannot: fronts past
  //     -0.9 rad and the body pitched nose-up past half a radian.
  //  2. THE CARRY. Three holds, three answers. The condor's is the one that
  //     changes over TIME, so it is sampled before and after capyHANG_FLAIL.
  //  3. THE FACE. A mood is 70 ms wide going in and 300 ms coming out; a
  //     screenshot of one is a coin toss. The asymmetry is the measurement.
  //  4. THE CROWD'S ARM. `gest` is set in sayBubble and read in animHuman, and
  //     neither is reachable — so this counts SPEAKERS and samples the arm.
  //  5. THE HERD'S LEGS. Skate, exactly as D2 measured it on the player.
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  const out = {}

  async function chapter(key) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(9000)
  }

  // ---- 1. the climb: chapter 11, which is the one built around it ----------
  await chapter('Minus')
  out.climb = await page.evaluate(() => new Promise(res => {
    const g = window.__capy
    // The Mong Kok scaffold. climbHold answers here; the pose is the test.
    const s = g.kowloon.scaffold
    g.capy.body.position.set(s.x - 1.2, 2.2, s.z)
    g.capy.body.velocity.set(0, 0, 0)
    const before = g.capy.animAudit()
    // E is the hold key: `input.action`, not actionPressed — held, not tapped.
    const ev = k => new KeyboardEvent(k, { code: 'KeyE', bubbles: true })
    window.dispatchEvent(ev('keydown'))
    let n = 0
    const t = setInterval(() => {
      if (++n > 26) {
        clearInterval(t)
        const mid = g.capy.animAudit()
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', bubbles: true }))
        setTimeout(() => res({ before: before, mid: mid, after: g.capy.animAudit(),
                               err: g.state.lastError || '' }), 900)
      }
    }, 100)
  }))
  await page.screenshot({ path: 'qa/d8-climb.png' })

  // ---- 2. the carry: three holds, one channel -----------------------------
  // THE POSE IS DRIVEN ENTIRELY BY `carriedBy` AND `carriedBy.hold`, so it is
  // exercised by setting that field to each of the three carriers in turn.
  // Whether a condor actually gets its talons into you is a different mechanism
  // — a summon, an approach and a press of E — which shipped in v20 and is not
  // what this measures. What this measures is that the three holds are three
  // different animals, and that the talons' one CHANGES with time.
  out.carry = await page.evaluate(() => new Promise(res => {
    const g = window.__capy
    const out = {}
    const holds = [['arms', { hold: 'arms' }], ['talons', { hold: 'talons' }],
                   ['ride', { hold: 'ride' }]]
    let k = 0
    function run() {
      if (k >= holds.length) { g.capy.carriedBy = null; res(out); return }
      const [tag, carrier] = holds[k++]
      g.capy.carriedBy = carrier
      const rows = []
      let n = 0
      const t = setInterval(() => {
        const a = g.capy.animAudit()
        rows.push({ t: +a.carryT.toFixed(2), hold: a.hold,
                    legX: a.legX.map(v => +v.toFixed(3)),
                    sway: +a.hangSway.toFixed(3), roll: +a.roll.toFixed(3) })
        if (++n > 16) { clearInterval(t); out[tag] = rows.filter((_, i) => i % 5 === 0); run() }
      }, 200)
    }
    run()
  }))

  // ---- 3. the face: Sydney, where every input is reachable ----------------
  await chapter('Digit1')
  out.face = await page.evaluate(() => new Promise(res => {
    const g = window.__capy
    const rows = []
    const push = tag => rows.push({ tag: tag, mood: +g.capy.animAudit().mood.toFixed(3) })
    push('rest')
    // the wheek: Q
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }))
    setTimeout(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', bubbles: true }))
      push('wheek+0.1')
      setTimeout(() => {
        push('wheek+0.5')
        setTimeout(() => {
          push('wheek+1.5')
          // the fall: drop it off the Opera House steps
          const c = g.capy.body.position
          g.capy.body.position.set(c.x, c.y + 34, c.z)
          g.capy.body.velocity.set(0, 0, 0)
          setTimeout(() => {
            push('falling')
            let blinks = 0, last = 0, n = 0
            const t = setInterval(() => {
              const b = g.capy.animAudit().blink
              if (b > 0.5 && last <= 0.5) blinks++
              last = b
              if (++n > 300) {
                clearInterval(t)
                res({ rows: rows, blinks: blinks, err: g.state.lastError || '' })
              }
            }, 40)
          }, 1600)
        }, 1000)
      }, 400)
    }, 100)
  }))

  // ---- 4. the crowd's talking arm ----------------------------------------
  out.crowd = await page.evaluate(() => new Promise(res => {
    const g = window.__capy
    let talkMax = 0, armMax = 0, n = 0, cast = 0
    const t = setInterval(() => {
      const a = g.gestAudit()
      cast = a.cast
      if (a.talking > talkMax) talkMax = a.talking
      if (a.armMax > armMax) armMax = a.armMax
      if (++n > 240) { clearInterval(t); res({ cast: cast, talkMax: talkMax, armMax: armMax }) }
    }, 100)
  }))

  // ---- 5. the herd -------------------------------------------------------
  await chapter('Semicolon')
  out.herd = await page.evaluate(() => new Promise(res => {
    const g = window.__capy
    const first = g.pantanal.herdAudit()
    // Wheek at them: THE HERD recruits, and a recruited animal RUNS, which is
    // the speed the fixed 8 rad/s was most wrong at.
    let n = 0
    const t = setInterval(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }))
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', bubbles: true }))
      if (++n > 3) {
        clearInterval(t)
        setTimeout(() => res({ first: first, after: g.pantanal.herdAudit(),
                               err: g.state.lastError || '' }), 4000)
      }
    }, 900)
  }))
  await page.screenshot({ path: 'qa/d8-herd.png' })

  await page.evaluate(o => fetch('/shot?name=d8-body.json',
      { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
