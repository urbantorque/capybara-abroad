async page => {
  // ROADMAP-WOW2, T — THE STRANGER, scripted honestly.
  //
  // The L6 method wants a second agent that reads nothing first and plays
  // three minutes. No second agent is available to this wave, so this is the
  // nearest honest thing: a bot that presses NOTHING but what the pill's words
  // name — no table of beats, no game state read for a decision, no arrow
  // steering. It knows the keyboard and English and that is all. A key word
  // in the pill is pressed the way a stranger would press it: a letter for a
  // tap, "hold" for a hold, "drag" for a drag, and "the bench" / "that hat" /
  // "the board" for a look round and a walk toward the thing the pill named,
  // if it can be found on the screen — which it cannot, so it walks a little
  // and tries the key. Afterwards it lists the six verbs the pills named and,
  // from the game's own counters, whether each was actually pressed and had
  // its effect. qa/wow2-stranger.md is written from this by hand.
  //
  // Writes qa/wow2-stranger.json: { pills: [...], pressed: {key: n}, verbs:
  // [{verb, named, pressed, effect}], counters, distance, runTime, hops }.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(400)
  const started = await page.evaluate(() => !!(window.__capy && window.__capy.state.started))
  // the game's own counters, from the first frame: distance, seconds at a
  // run, hops (capy:land), wheeks, grabs, journal opens, camera yaw turned
  await page.evaluate(() => {
    const g = window.__capy
    const C = window.__str = { dist: 0, runT: 0, hops: 0, wheeks: 0, grabs: 0, tabs: 0, yaw: 0, last: null, yawLast: g.input.camYaw, jrWas: false }
    g.events.on('capy:wheek', () => C.wheeks++)
    g.events.on('capy:grab', () => C.grabs++)
    g.events.on('capy:land', () => C.hops++)
    setInterval(() => {
      const c = g.capy; if (!c) return
      const p = c.position
      if (C.last) C.dist += Math.hypot(p.x - C.last.x, p.z - C.last.z)
      C.last = { x: p.x, z: p.z }
      if (c.isRunning) C.runT += 0.1
      let d = g.input.camYaw - C.yawLast; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI
      C.yaw += Math.abs(d); C.yawLast = g.input.camYaw
      const jr = !!document.querySelector('.capyui-journal.show, .capyui-jr.show')
      if (jr && !C.jrWas) C.tabs++
      C.jrWas = jr
    }, 100)
  })
  const T0 = Date.now()
  const out = { started, pills: [], pressed: {}, err: null }
  const held = new Set()
  function count(k) { out.pressed[k] = (out.pressed[k] || 0) + 1 }
  async function down(k) { if (!held.has(k)) { count(k) } await page.keyboard.down(k); held.add(k) }
  async function up(k) { if (held.has(k)) { await page.keyboard.up(k); held.delete(k) } }
  async function release() { for (const k of [...held]) await up(k) }
  async function tap(k, ms) { count(k); await page.keyboard.down(k); await page.waitForTimeout(ms || 300); await page.keyboard.up(k) }
  async function drag() {
    count('drag')
    await page.mouse.move(640, 380); await page.mouse.down({ button: 'right' })
    await page.mouse.move(320, 380, { steps: 12 }); await page.mouse.up({ button: 'right' })
  }
  async function pill() {
    return page.evaluate(() => {
      const e = [...document.querySelectorAll('.capyui-toast.tut')].filter(e => !e.classList.contains('out') && !e.dataset.going)[0]
      return { text: e ? e.textContent : '', done: window.__capy.tutAudit().done, err: window.__capy.state.lastError || null }
    })
  }
  let last = '', step = 0
  while (Date.now() - T0 < 185000) {
    const P = await pill()
    if (P.err && !out.err) out.err = String(P.err).slice(0, 200)
    if (P.done) break
    if (P.text !== last) {
      last = P.text; step = 0; await release()
      if (P.text) out.pills.push({ t: +((Date.now() - T0) / 1000).toFixed(1), text: P.text })
    }
    const w = P.text
    if (!w) { await page.waitForTimeout(250); continue }
    step++
    // ---- the words: a stranger's reading of them --------------------------
    if (/\bW, A, S, D\b/.test(w)) {
      // four letters: press each in turn, then walk on W
      if (step === 1) { await tap('KeyW', 600); await tap('KeyA', 400); await tap('KeyS', 300); await tap('KeyD', 400) }
      await down('KeyW')
    } else if (/hold Shift/.test(w)) {
      await down('ShiftLeft'); await down('KeyW')
    } else if (/\bSpace\b/.test(w)) {
      // "at the bench": walk somewhere and hop; the stranger cannot see a
      // bench from the words, so it hops where it is and walks a little
      await down('KeyW'); await page.waitForTimeout(500); await tap('Space', 350); await page.waitForTimeout(600)
      if (step % 3 === 0) { await release(); await tap('KeyA', 500) }
    } else if (/\bQ\b/.test(w)) {
      if (step === 1 || step % 12 === 0) await tap('KeyQ', 350)
    } else if (/\bE\b/.test(w)) {
      // "that hat": walk about and press E now and then
      await down('KeyW'); await page.waitForTimeout(600); await release()
      await tap('KeyE', 240)
      if (step % 2 === 0) await tap('KeyD', 400)
    } else if (/\bTab\b/.test(w)) {
      if (step === 1) { await tap('Tab', 300); await page.waitForTimeout(1500); await tap('Escape', 200) }
    } else if (/\bdrag\b|\bC\b/.test(w)) {
      if (step === 1) { await tap('KeyC', 300); await page.waitForTimeout(800) }
      else if (step === 2) { await drag(); await page.waitForTimeout(600) }
    } else if (/board|gate|wheeks/.test(w)) {
      // "the board by the gate": the stranger walks, and looks for a gate by
      // turning now and then; "three wheeks" is not for now, the pill says so
      await down('KeyW'); await down('ShiftLeft')
      if (step % 8 === 0) { await release(); await tap('KeyD', 700) }
    } else {
      await release()
    }
    await page.waitForTimeout(250)
  }
  await release()
  const C = await page.evaluate(() => {
    const g = window.__capy, C = window.__str
    return { dist: +C.dist.toFixed(1), runT: +C.runT.toFixed(1), hops: C.hops, wheeks: C.wheeks, grabs: C.grabs, tabs: C.tabs,
             yawDeg: Math.round(C.yaw * 180 / Math.PI), audit: g.tutAudit(), tasksDone: g.hud.tasksDone(), wheekRow: g.taskDone('wheek') }
  })
  out.counters = C
  out.elapsed = +((Date.now() - T0) / 1000).toFixed(1)
  const named = out.pills.map(p => p.text).join(' ')
  out.verbs = [
    { verb: 'move (WASD)', named: /W, A, S, D/.test(named), pressed: !!(out.pressed.KeyW), effect: C.dist >= 4 },
    { verb: 'run (Shift)', named: /Shift/.test(named), pressed: !!out.pressed.ShiftLeft, effect: C.runT >= 1.2 },
    { verb: 'hop (Space)', named: /Space/.test(named), pressed: !!out.pressed.Space, effect: C.hops >= 1 },
    { verb: 'wheek (Q)', named: /\bQ\b/.test(named), pressed: !!out.pressed.KeyQ, effect: C.wheeks >= 1 && C.wheekRow },
    { verb: 'take (E)', named: /\bE\b/.test(named), pressed: !!out.pressed.KeyE, effect: C.grabs >= 1 },
    { verb: 'the paper (Tab)', named: /Tab/.test(named), pressed: !!out.pressed.Tab, effect: C.audit.tabs >= 1 },
    { verb: 'look (drag / C)', named: /drag|\bC\b/.test(named), pressed: !!(out.pressed.KeyC || out.pressed.drag), effect: C.yawDeg >= 60 },
    { verb: 'the door (the board)', named: /board/.test(named), pressed: null, effect: C.audit.how === 'walked' && C.audit.hits >= 8 },
  ]
  await page.evaluate((o) => fetch('/shot?name=wow2-stranger.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
