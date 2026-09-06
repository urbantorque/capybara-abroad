async page => {
  // A3 + A2 for one-shots. Three questions:
  //   1. does a burst schedule the flaps it says it does, and do they SPREAD
  //      across the stereo field (which is the whole mechanism)?
  //   2. does one burst cost one voice slot, not fourteen?
  //   3. does the back/up filter appear only when there is something to say?
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)

  const out = await page.evaluate(async () => {
    const g = window.__capy
    // Count what a burst actually builds. create* lives on the PROTOTYPE —
    // patching AudioContext.prototype counts zero and reads as "no audio".
    // create* lives on BaseAudioContext.prototype — patching
    // AudioContext.prototype counts zero and reads as "no audio" (F-trap 29).
    const P = Object.getPrototypeOf(window.AudioContext.prototype)
    const made = {}
    const orig = {}
    for (const k of ['createBufferSource', 'createBiquadFilter', 'createGain',
                     'createStereoPanner', 'createOscillator']) {
      orig[k] = P[k]
      P[k] = function () { made[k] = (made[k] || 0) + 1; return orig[k].apply(this, arguments) }
    }
    const pos = g.capy.position
    const count = () => Object.keys(made).reduce((s, k) => s + made[k], 0)
    const reset = () => { for (const k in made) delete made[k] }

    // ---- one burst, ten flaps, close enough to be heard --------------------
    reset()
    const flaps = g.hud.wingburstAudit(pos.x + 8, pos.y + 4, pos.z + 2, { n: 10 })
    const burstNodes = count()
    const burstKinds = JSON.parse(JSON.stringify(made))

    // ---- the same burst, four hundred metres away: culled, no graph --------
    reset()
    const farFlaps = g.hud.wingburstAudit(pos.x + 600, pos.y, pos.z, { n: 10 })
    const farNodes = count()

    // ---- one slot, not ten ------------------------------------------------
    const before = (g.hud.mixAudit && g.hud.mixAudit().voiceDrops) || 0
    reset()
    let total = 0
    for (let i = 0; i < 3; i++) total += g.hud.wingburstAudit(pos.x + 8, pos.y + 4, pos.z + 2, { n: 12 })
    const threeNodes = count()

    for (const k in orig) P[k] = orig[k]

    // ---- A2: the axes, and whether the filter follows them ----------------
    const e = g.hud.audioProbe(0, 0, 0).ear
    const probes = {}
    const dirs = { ahead: null, behind: null, above: null }
    // find the true ahead/behind bearings from the ring
    let bestBack = -1, bestFwd = 2, ba = 0, fa = 0
    for (let i = 0; i < 32; i++) {
      const a = i * Math.PI / 16
      const p = g.hud.audioProbe(e.x + Math.cos(a) * 25, e.y, e.z + Math.sin(a) * 25, 60, 400)
      if (p.back > bestBack) { bestBack = p.back; ba = a }
      if (p.back < bestFwd) { bestFwd = p.back; fa = a }
    }
    probes.behind = g.hud.audioProbe(e.x + Math.cos(ba) * 25, e.y, e.z + Math.sin(ba) * 25, 60, 400)
    probes.ahead = g.hud.audioProbe(e.x + Math.cos(fa) * 25, e.y, e.z + Math.sin(fa) * 25, 60, 400)
    probes.above = g.hud.audioProbe(e.x, e.y + 25, e.z, 60, 400)

    // Does a placed one-shot BUILD the extra filter only where it should?
    const filt = {}
    for (const [nm, pt] of [['ahead', [e.x + Math.cos(fa) * 25, e.y, e.z + Math.sin(fa) * 25]],
                            ['behind', [e.x + Math.cos(ba) * 25, e.y, e.z + Math.sin(ba) * 25]],
                            ['above', [e.x, e.y + 25, e.z]]]) {
      let n = 0
      const o = P.createBiquadFilter
      P.createBiquadFilter = function () { n++; return o.apply(this, arguments) }
      g.sfx('tick', { at: { x: pt[0], y: pt[1], z: pt[2] }, near: 60, far: 400, force: true })
      P.createBiquadFilter = o
      filt[nm] = n
      await new Promise(r => setTimeout(r, 260))
    }

    return {
      biome: g.biome.current, lastError: g.state.lastError || null,
      flaps: flaps, burstNodes: burstNodes, burstKinds: burstKinds,
      nodesPerFlap: flaps ? +(burstNodes / flaps).toFixed(2) : 0,
      farFlaps: farFlaps, farNodes: farNodes,
      threeBursts: { flaps: total, nodes: threeNodes },
      voiceDropsBefore: before,
      voiceDropsAfter: (g.hud.mixAudit && g.hud.mixAudit().voiceDrops) || 0,
      axes: { ahead: { back: probes.ahead.back, up: probes.ahead.up, pan: probes.ahead.pan },
              behind: { back: probes.behind.back, up: probes.behind.up, pan: probes.behind.pan },
              above: { back: probes.above.back, up: probes.above.up, pan: probes.above.pan } },
      filters: filt,
    }
  })

  // ---- and the real trigger, through the real door ------------------------
  out.live = await page.evaluate(async () => {
    const g = window.__capy
    const seen = []
    // create* lives on BaseAudioContext.prototype — patching
    // AudioContext.prototype counts zero and reads as "no audio" (F-trap 29).
    const P = Object.getPrototypeOf(window.AudioContext.prototype)
    const o = P.createBufferSource
    let n = 0
    P.createBufferSource = function () { n++; return o.apply(this, arguments) }
    // A wheek is what puts Sydney's lorikeets up, and it is the one trigger a
    // probe can pull. Two, thirty seconds apart, to clear the 12 s source gate.
    for (let i = 0; i < 2; i++) {
      n = 0
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }))
      await new Promise(r => setTimeout(r, 120))
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', bubbles: true }))
      await new Promise(r => setTimeout(r, 2500))
      seen.push(n)
      await new Promise(r => setTimeout(r, 13000))
    }
    P.createBufferSource = o
    return { bufferSourcesPerWheek: seen }
  })

  out.errs = errs
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=flock.json', { method: 'POST', body: s })
  }, out)
}
