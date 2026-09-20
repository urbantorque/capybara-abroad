async page => {
  // ROADMAP-WOW2, T — THE FIRST WALK, walked by a bot that reads only the pill.
  //
  // One run per run-code invocation (a fresh page, localStorage cleared before
  // goto). From Begin the bot reads the live tutorial pill off the DOM every
  // 250 ms — `.capyui-toast.tut` — and performs the key the WORDS name: W A S D
  // walks, Shift runs, Space hops at the bench, Q, E at the hat, Tab, C or a
  // drag, and "the board" is walked to. Where the pill says "at the bench" or
  // "that hat" or "the board" the bot steers by the paper's own arrow — the
  // rotate() on `.capyui-aim.on .capyui-arrow` and its metres — the same two
  // things a player would look at. game.tutAudit() is read for the LOG only,
  // never for a decision.
  //
  // Writes qa/wow2-tut-run-<stamp>.json: { begun, beat8At, endHow, hits,
  // beats: [{ n, pill, at, closedAt, hit }], counters } and one real
  // page.screenshot per beat, qa/wow2-tut-beat<N>.png, taken ~0.7 s after the
  // pill rose so the ease-in is over. qa/wow2-tutorial-sum.mjs folds ten of
  // these into the table.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(400)
  const started = await page.evaluate(() => !!(window.__capy && window.__capy.state.started))
  const T0 = Date.now()
  const out = { started, begun: T0, beats: [], endHow: '', beat8At: null, hits: 0, err: null, shots: [] }

  const held = new Set()
  async function setKeys(want) {
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k) }
    for (const k of [...held]) if (!want.includes(k)) { await page.keyboard.up(k); held.delete(k) }
    // a held movement key is re-sent each step (harness trap: a held key that
    // is never re-sent reads as released after the first repeat)
    for (const k of want) await page.keyboard.down(k)
  }
  async function tap(k, ms) { await page.keyboard.down(k); await page.waitForTimeout(ms || 350); await page.keyboard.up(k) }
  async function drag() {
    // the right button: the left is the grab (pointerdown, systems.js)
    await page.mouse.move(640, 380); await page.mouse.down({ button: 'right' })
    await page.mouse.move(300, 380, { steps: 12 }); await page.mouse.up({ button: 'right' })
  }
  /** what is on the screen: the pill's words, the arrow, the metres */
  async function look() {
    return page.evaluate(() => {
      const g = window.__capy
      const pill = [...document.querySelectorAll('.capyui-toast.tut')].filter(e => !e.classList.contains('out') && !e.dataset.going).map(e => e.textContent)[0] || ''
      let deg = null, dist = ''
      for (const a of document.querySelectorAll('.capyui-aim.on')) {
        if (!a.parentNode || a.parentNode.tagName !== 'LI') continue
        const ar = a.querySelector('.capyui-arrow')
        const m = ar && /rotate\((-?[\d.]+)deg\)/.exec(ar.style.transform || '')
        if (m) deg = +m[1]
        const d = a.querySelector('span'); dist = d ? d.textContent : ''
        break
      }
      // the chart's own chip: metres to the arrow's target, to a tenth under ten
      const mc = document.querySelector('.capyui-mapdist.show span')
      const mm = mc && /^([0-9.]+) m$/.exec(mc.textContent)
      const m = mm ? +mm[1] : null
      const au = typeof g.tutAudit === 'function' ? g.tutAudit() : null
      const cp = g.capy ? g.capy.position : { x: 0, y: 0, z: 0 }
      return { pill, deg, dist, m, au, swim: !!(g.capy && g.capy.swimming), x: +cp.x.toFixed(1), y: +cp.y.toFixed(2), z: +cp.z.toFixed(1), err: g.state.lastError || null }
    })
  }
  /** keys that walk along the arrow: screen-up is W, clockwise degrees */
  function keysFor(deg) {
    if (deg === null) return ['KeyW']
    const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r)
    const k = []
    if (c > 0.38) k.push('KeyW'); if (c < -0.38) k.push('KeyS')
    if (s > 0.38) k.push('KeyD'); if (s < -0.38) k.push('KeyA')
    return k.length ? k : ['KeyW']
  }

  let lastPill = '', beatN = 0, beatState = null, cur = null
  const trace = []
  let stuckAt = null, stuckT = 0
  /** a player who has not moved in a second and a half hops and sidesteps */
  let unstuckN = 0, dryKeys = []
  async function unstick(L) {
    // sliding along a wall at a metre a second counts as stuck too
    // (MEASURED: the seawall at z 13 held the bot for twenty seconds)
    if (stuckAt && Math.hypot(L.x - stuckAt.x, L.z - stuckAt.z) < 1.6) stuckT += 0.25
    else { stuckAt = { x: L.x, z: L.z }; stuckT = 0 }
    if (stuckT >= 1.5) {
      stuckT = 0; unstuckN++
      // a hop first; then a detour to one side or the other for two seconds
      const side = unstuckN % 2 ? 'KeyA' : 'KeyD'
      await setKeys([side]); await tap('Space', 350); await page.waitForTimeout(400)
      if (unstuckN > 1) { await setKeys([side, 'ShiftLeft']); await page.waitForTimeout(2000) }
      stuckAt = null
    }
  }
  const tEnd = T0 + 240000
  while (Date.now() < tEnd) {
    const L = await look()
    if (L.err && !out.err) out.err = String(L.err).slice(0, 200)
    const now = (Date.now() - T0) / 1000
    if (L.au && L.au.done) {
      out.endHow = L.au.how; out.hits = L.au.hits; out.endAt = +now.toFixed(1)
      if (cur && !cur.closedAt) { cur.closedAt = +now.toFixed(1); cur.hit = L.au.hits > (cur.hits0 || 0) }
      if (L.au.how === 'walked') out.beat8At = +now.toFixed(1)
      out.counters = L.au
      break
    }
    if (L.pill !== lastPill) {
      if (cur && !cur.closedAt) { cur.closedAt = +now.toFixed(1); cur.hit = L.au ? L.au.hits > cur.hits0 : null }
      lastPill = L.pill
      if (L.pill) {
        beatN++
        cur = { n: beatN, beat: L.au ? L.au.beat : null, pill: L.pill, at: +now.toFixed(1), closedAt: null, hit: null, hits0: L.au ? L.au.hits : 0 }
        out.beats.push(cur)
        beatState = { t0: Date.now(), tapped: false, dragged: false, hops: 0, lastNear: 0 }
        await setKeys([])
        await page.waitForTimeout(700)
        const shot = 'qa/wow2-tut-beat' + (/stall/.test(L.pill) ? '5b' : (L.au && L.au.beat ? L.au.beat : beatN)) + '.png'
        try { await page.screenshot({ path: shot }); out.shots.push(shot) } catch (e) {}
      } else {
        cur = null; await setKeys([])
      }
    }
    const p = L.pill
    if (trace.length < 900) trace.push([+now.toFixed(1), L.x, L.z, L.deg, L.dist, L.au ? L.au.beat : 0])
    if (!p) { await page.waitForTimeout(250); continue }
    const dt = (Date.now() - beatState.t0) / 1000
    // ---- the words, and nothing else ---------------------------------------
    if (/W, A, S, D/.test(p)) {
      // walk: forward, with a lean to one side after a second
      await setKeys(dt < 1.2 ? ['KeyW'] : ['KeyW', 'KeyD'])
    } else if (/Shift/.test(p)) {
      await setKeys(['KeyW', 'ShiftLeft'])
    } else if (/Space/.test(p)) {
      // toward the arrow, by the arrow; the chart's chip says the metres
      // once under ten, and a hop from a walk at two metres lands on the
      // seat (MEASURED: a run-up overshoots a two-metre bench every time,
      // and a hop from against the backrest goes nowhere)
      const near = L.m !== null && L.m < 2.3
      await setKeys(keysFor(L.deg))
      if (!near) await unstick(L)
      if (near) {
        beatState.hops++
        await page.waitForTimeout(150)
        await tap('Space', 350)
        await page.waitForTimeout(700)
      }
    } else if (/\bQ\b/.test(p)) {
      if (!beatState.tapped || dt > 4) { beatState.tapped = true; await tap('KeyQ', 350); beatState.t0 = Date.now() }
    } else if (/\bE\b/.test(p)) {
      // the arrow stops at 4.5 m ("here") and the mouth reaches 1.6: walk on
      // along the arrow in half-second steps and press E after each
      const near = L.m !== null && L.m < 2.6
      await setKeys(keysFor(L.deg))
      if (near) {
        await page.waitForTimeout(300)
        // under capyDIG_TIME (0.34 s): a longer press standing still is a dig,
        // and a dig in the gardens brings the gardener
        await tap('KeyE', 240)
      } else await unstick(L)
    } else if (/Tab/.test(p)) {
      if (!beatState.tapped) {
        beatState.tapped = true
        await tap('Tab', 300)
        await page.waitForTimeout(1200)
        await tap('Escape', 200)
      }
    } else if (/drag|\bC\b/.test(p)) {
      if (!beatState.tapped) { beatState.tapped = true; await tap('KeyC', 300); await page.waitForTimeout(900) }
      else if (!beatState.dragged) { beatState.dragged = true; await drag(); await page.waitForTimeout(600) }
      else await tap('KeyZ', 600)
    } else if (/board|gate/.test(p)) {
      if (L.swim) {
        // in the harbour (a player would see it): back out onto the paving,
        // then along the wall on the arrow's side until the next gap
        // back the way it came in (MEASURED: reversing the ARROW swam it
        // east along the harbour, away from the wharf and still in the water)
        const back = (dryKeys.length ? dryKeys : keysFor(L.deg)).map(k => ({ KeyW: 'KeyS', KeyS: 'KeyW', KeyA: 'KeyD', KeyD: 'KeyA' })[k])
        await setKeys(back.concat(['ShiftLeft'])); await page.waitForTimeout(1800)
        const L2 = await look()
        const side = (L2.deg !== null && Math.sin(L2.deg * Math.PI / 180) < 0) ? 'KeyA' : 'KeyD'
        await setKeys([side, 'ShiftLeft']); await page.waitForTimeout(3500)
        stuckAt = null
      } else {
        dryKeys = keysFor(L.deg)
        await setKeys(keysFor(L.deg).concat(['ShiftLeft']))
        await unstick(L)
      }
    } else if (/stall|yuzu/.test(p)) {
      // the shop clause: nothing to press
      await setKeys([])
    }
    await page.waitForTimeout(250)
  }
  await setKeys([])
  if (!out.counters) { const L = await look(); out.counters = L.au }
  out.totalS = +((Date.now() - T0) / 1000).toFixed(1)
  // ...and the GAME's own clock for the same span: a headless browser
  // sharing a machine runs rAF slow, and the roadmap's 180 s is a player's
  // three minutes of game, not of a contended CPU. Both are reported.
  out.gameS = out.counters ? out.counters.endAt : null
  out.trace = trace
  await page.evaluate((o) => fetch('/shot?name=wow2-tut-run-' + Date.now() + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
