async page => {
  // L6 E4 — the paper, the pills, and the reason why. See ROADMAP-LIFT6 §E4.
  //   Sydney: 120 s soak — 0 frames with identical bubble+pill text, every
  //   heard pill quoted; the hat row armed within 1 s of the grab; the
  //   concert's why-not after a Q 8 m from the podium.
  //   Venice: from acqua-alta going live, ≤ 1 pill and no moment card for 6 s;
  //   leaf text nodes ≤ 30 in marquee-live frames.
  //   Arrival frames (Sydney/Venice/Hanoi): paper ≤ 45 % of 760, ≤ 12 rendered
  //   lines, min font ≥ 10.5 px. chapRecap one sentence on a played save.
  const TAG = 'l6-paper'
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(5000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(6000)
  const out = { started: await page.evaluate(() => window.__capy.state.started) }
  const post = async () => page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
  const shot = (n) => page.screenshot({ path: 'qa/' + TAG + '-' + n + '.png' })

  // ---- one frame's text surfaces ------------------------------------------
  const snap = () => page.evaluate(() => {
    const vis = (el) => {
      if (!el) return false
      try { if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false } catch (e) {}
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) return false
      if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return false
      return true
    }
    const o = { toasts: [], bubbles: [], leaves: 0, moment: false, placeLine: '' }
    for (const el of document.querySelectorAll('.capyui-toast')) if (vis(el)) o.toasts.push({ txt: (el.innerText || '').replace(/\s+/g, ' ').trim(), heard: el.classList.contains('heard'), note: el.classList.contains('note') })
    for (const el of document.querySelectorAll('.capynpc-bubble')) if (vis(el)) o.bubbles.push((el.innerText || '').replace(/\s+/g, ' ').trim())
    let n = 0
    o.leafNames = []
    for (const el of document.querySelectorAll('[class*="capyui-"], .capynpc-bubble')) if (el.children.length === 0 && (el.innerText || '').trim() && vis(el)) { n++; o.leafNames.push(el.className) }
    o.leaves = n
    const m = document.querySelector('.capyui-moment')
    o.moment = !!(m && m.classList.contains('show'))
    const pl = document.querySelector('.capyui-placeline')
    if (pl && vis(pl)) o.placeLine = pl.textContent
    const g = window.__capy
    o.live = g.wowLiveAt()
    o.t = +g.state.time.toFixed(1)
    o.err = g.state.lastError || null
    return o
  })
  // ---- the paper on an arrival frame ----------------------------------------
  const paper = () => page.evaluate(() => {
    const vis = (el) => {
      try { if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false } catch (e) {}
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false
      const r = el.getBoundingClientRect()
      return r.width > 1 && r.height > 1 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth
    }
    const todo = document.querySelector('.capyui-todo')
    const r = todo.getBoundingClientRect()
    let lines = 0, minFs = 99, minEl = '', clues = 0
    const seen = []
    for (const el of todo.querySelectorAll('*')) {
      if (el.children.length && !(el.classList.contains('capyui-txt'))) continue
      const t = (el.innerText || '').trim()
      if (!t || !vis(el)) continue
      const cs = getComputedStyle(el)
      const fs = parseFloat(cs.fontSize)
      const rg = document.createRange(); rg.selectNodeContents(el)
      const tops = new Set(); for (const rc of rg.getClientRects()) if (rc.width > 0 && rc.height < fs * 1.9) tops.add(Math.round(rc.top / 4))
      const n = Math.max(1, tops.size)
      lines += n
      if (fs < minFs) { minFs = fs; minEl = el.className }
      seen.push([el.className, n, fs, t.slice(0, 40)])
    }
    for (const c of ['.capyui-clue', '.capyui-marqhow']) { const e = todo.querySelector(c); if (e && vis(e) && (e.innerText || '').trim()) clues++ }
    let hudMin = 99, hudMinEl = ''
    for (const el of document.querySelectorAll('[class*="capyui-"]')) {
      if (el.children.length) continue
      if (!(el.innerText || '').trim() || !vis(el)) continue
      const fs = parseFloat(getComputedStyle(el).fontSize)
      if (fs < hudMin) { hudMin = fs; hudMinEl = el.className }
    }
    return { h: Math.round(r.height), pct: +(r.height / innerHeight * 100).toFixed(1), w: Math.round(r.width), lines, minFs, minEl, clues, hudMin, hudMinEl, rows: seen }
  })

  // ---- SYDNEY: the arrival frame --------------------------------------------
  await page.waitForTimeout(2000)
  out.sydneyArrive = await paper()
  await shot('sydney-arrive')

  // ---- SYDNEY: the 120 s soak — bubbles vs pills ----------------------------
  const kb = page.keyboard
  const keys = async (t) => {
    const phase = Math.floor(t / 2) % 12
    await kb.up('KeyA'); await kb.up('KeyD'); await kb.up('ShiftLeft'); await kb.up('KeyS')
    if (phase < 9) await kb.down('KeyW'); else await kb.up('KeyW')
    if (phase === 2 || phase === 6) await kb.down('KeyA')
    if (phase === 4 || phase === 8) await kb.down('KeyD')
    if (phase === 3 || phase === 7) await kb.down('ShiftLeft')
    if (phase === 5) await kb.press('Space')
    if (phase === 9) await kb.press('KeyQ')
    if (phase === 10) await kb.press('KeyE')
    if (phase === 11) await kb.down('KeyS')
  }
  const soak = { frames: 0, same: 0, sameEx: [], heard: 0, heardNoQuote: 0, heardEx: [], maxToasts: 0, toastsSeen: [], leavesMax: 0, moments: 0 }
  out.sydneySoak = soak
  const t0 = Date.now()
  let heardShot = false, tabShot = false
  for (let s = 0; s < 240; s++) {
    if (s % 4 === 0) await keys(s / 2)
    await page.waitForTimeout(500)
    const sn = await snap()
    soak.frames++
    if (sn.err) { out.err = sn.err; break }
    if (sn.toasts.length > soak.maxToasts) soak.maxToasts = sn.toasts.length
    if (sn.leaves > soak.leavesMax) soak.leavesMax = sn.leaves
    if (sn.moment) soak.moments++
    for (const t of sn.toasts) {
      if (!soak.toastsSeen.find(x => x.txt === t.txt)) soak.toastsSeen.push({ t: sn.t, txt: t.txt, heard: t.heard, note: t.note })
      const core = t.txt.replace(/^[“"]\s*/, '').replace(/\s*[”"]\s*—.*$/, '')
      if (sn.bubbles.some(b => b === t.txt || b === core)) { soak.same++; if (soak.sameEx.length < 5) soak.sameEx.push([sn.t, t.txt]) }
      if (t.heard) {
        if (!soak.heardEx.find(x => x === t.txt)) { soak.heard++; soak.heardEx.push(t.txt); if (t.txt.indexOf('“') < 0) soak.heardNoQuote++ }
        if (!heardShot) { heardShot = true; await shot('heard') }
      }
    }
    if (!tabShot && s > 30) { const away = await page.evaluate(() => document.querySelector('.capyui-todo').classList.contains('away')); if (away) { tabShot = true; await shot('tab') } }
  }
  for (const k of ['KeyW', 'KeyA', 'KeyD', 'KeyS', 'ShiftLeft']) await kb.up(k)
  out.toastAudit1 = await page.evaluate(() => window.__capy.hud.toastAudit())

  // ---- SYDNEY: the hat, armed ------------------------------------------------
  const held = new Set()
  const setKeys = async (want) => {
    for (const k of [...held]) if (!want.has(k)) { await kb.up(k); held.delete(k) }
    for (const k of want) if (!held.has(k)) { await kb.down(k); held.add(k) }
  }
  const tap = async (k, ms) => { await kb.down(k); await page.waitForTimeout(ms || 90); await kb.up(k) }
  const hat = { legs: 0, grabbedAt: -1, armedAt: -1, dt: -1, row: '' }
  out.hat = hat
  // Hold R would be a rescue; instead walk the arrow. If the hat is not
  // reached in 60 s, teleport beside the wearer and press E (trap 40: pin).
  const tH = Date.now()
  let lastD = 1e9, stuckT = 0
  while ((Date.now() - tH) / 1000 < 60) {
    const s = await page.evaluate(() => {
      const g = window.__capy, p = g.capy.position
      const h = g.hintTarget('steal-hat')
      return { x: p.x, z: p.z, camYaw: g.input.camYaw, target: h, held: g.capy.heldProp ? g.capy.heldProp.type : '', done: g.taskDone('steal-hat'), t: g.state.time }
    })
    if (s.held === 'hat' || s.done) break
    if (!s.target) break
    const dx = s.target.x - s.x, dz = s.target.z - s.z, d = Math.hypot(dx, dz)
    const cy = Math.cos(s.camYaw), sy = Math.sin(s.camYaw)
    const ix = dx * cy - dz * sy, iz = dx * sy + dz * cy
    const want = new Set()
    if (d > 1.4) {
      if (iz < -0.3 * d) want.add('KeyW'); if (iz > 0.3 * d) want.add('KeyS')
      if (ix < -0.3 * d) want.add('KeyA'); if (ix > 0.3 * d) want.add('KeyD')
      if (d > 12) want.add('ShiftLeft')
    }
    await setKeys(want)
    if (d < 2.6) { await tap('KeyE', 140); await page.waitForTimeout(100) }
    if (lastD - d < 0.15) stuckT += 0.3; else stuckT = 0
    lastD = d
    if (stuckT > 2.0) { await tap('Space', 90); stuckT = 0.8 }
    hat.legs++
    await page.waitForTimeout(200)
  }
  await setKeys(new Set())
  let hs = await page.evaluate(() => { const g = window.__capy; return { held: g.capy.heldProp ? g.capy.heldProp.type : '', t: g.state.time } })
  if (hs.held !== 'hat') {
    // the pin: beside the wearer, facing them, E on every frame for 3 s
    hat.pinned = true
    await page.evaluate(() => {
      const g = window.__capy
      const h = g.hintTarget('steal-hat'); if (!h) return
      const p = g.capy.position
      const dx = h.x - p.x, dz = h.z - p.z, d = Math.hypot(dx, dz) || 1
      const tx = h.x - dx / d * 1.0, tz = h.z - dz / d * 1.0
      window.__pin = setInterval(() => { const b = g.capy.body; if (!b) return; b.position.x = tx; b.position.z = tz; b.velocity.x = 0; b.velocity.z = 0 }, 16)
      setTimeout(() => clearInterval(window.__pin), 3200)
    })
    for (let i = 0; i < 12; i++) { await tap('KeyE', 120); await page.waitForTimeout(140); hs = await page.evaluate(() => { const g = window.__capy; return { held: g.capy.heldProp ? g.capy.heldProp.type : '', t: g.state.time } }); if (hs.held === 'hat') break }
  }
  if (hs.held === 'hat') {
    hat.grabbedAt = hs.t
    for (let i = 0; i < 30; i++) {
      const a = await page.evaluate(() => {
        const g = window.__capy
        const r = document.querySelector('.capyui-task.capyui-hidden') // placeholder to keep the query cheap
        const li = [...document.querySelectorAll('.capyui-task')].find(el => (el.querySelector('.capyui-txt') || {}).textContent === 'Steal a tourist’s hat')
        const ar = li ? li.querySelector('.capyui-armed') : null
        return { t: g.state.time, on: !!(ar && ar.classList.contains('on') && getComputedStyle(ar).display !== 'none'), row: li ? li.innerText.replace(/\s+/g, ' ') : '', audit: g.physics.getawayAudit().armed }
      })
      if (a.on) { hat.armedAt = a.t; hat.dt = +(a.t - hat.grabbedAt).toFixed(2); hat.row = a.row; break }
      hat.row = a.row; hat.audit = a.audit
      await page.waitForTimeout(100)
    }
    await shot('armed')
  }

  // ---- SYDNEY: the concert's why-not, 8 m from the podium -----------------
  await page.evaluate(() => {
    const g = window.__capy
    const z = g.env.zones.operaStage
    const cx = (z.x0 + z.x1) / 2, cz = (z.z0 + z.z1) / 2 + 8
    window.__pin2 = setInterval(() => { const b = g.capy.body; b.position.x = cx; b.position.z = cz; if (b.position.y < 0.5) b.position.y = 0.6; b.velocity.x = 0; b.velocity.z = 0 }, 16)
    setTimeout(() => clearInterval(window.__pin2), 2500)
  })
  await page.waitForTimeout(1500)
  await tap('KeyQ', 90)
  await page.waitForTimeout(700)
  const whyA = await snap()
  out.why = { toasts: whyA.toasts.map(t => t.txt), placeLine: whyA.placeLine, audit: await page.evaluate(() => window.__capy.hud.toastAudit()), pos: await page.evaluate(() => { const p = window.__capy.capy.position; return [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)] }), concert: await page.evaluate(() => window.__capy.env.concertAudit()) }
  await shot('why')
  // ...and on the deck beside the red (the podium is 0.3 m up now)
  out.podium = await page.evaluate(() => {
    const g = window.__capy
    const z = g.env.zones.operaStage
    return { zone: z, stageY: null }
  })

  // ---- the recap, on a save with a history ---------------------------------
  out.recap = await page.evaluate(() => [1, 10, 19].map(n => window.__capy.hud.chapRecap(n)))
  await page.evaluate(() => { window.__capy.hud.showDone(1, 'you are taking  ·  a gum leaf', 'that will do here') })
  await page.waitForTimeout(1400)
  out.done = await page.evaluate(() => {
    const e = document.querySelector('.capyui-donelines'); const cs = getComputedStyle(e)
    const r = e.getBoundingClientRect()
    return { txt: e.textContent, tt: cs.textTransform, fs: cs.fontSize, style: cs.fontStyle, lines: Math.round(r.height / (parseFloat(cs.lineHeight) || 16)), hidden: e.hidden }
  })
  await shot('done')
  await page.waitForTimeout(5000)

  // ---- VENICE: the arrival, then the flood ---------------------------------
  await page.evaluate(() => { window.__capy.hud.cross('venice') })
  await page.waitForTimeout(9500)
  out.veniceBiome = await page.evaluate(() => window.__capy.biome.current)
  out.veniceArrive = await paper()
  await shot('venice-arrive')
  // the square, and the tide brought up to the crossing
  await page.evaluate(() => {
    const g = window.__capy
    window.__pin3 = setInterval(() => { const b = g.capy.body; b.position.x = -4; b.position.z = -35; if (b.position.y < 0.3) b.position.y = 0.6; b.velocity.x = 0; b.velocity.z = 0 }, 16)
    setTimeout(() => clearInterval(window.__pin3), 3000)
  })
  await page.waitForTimeout(2500)
  // a Q in the square before the water: the chapter-neutral why
  await tap('KeyQ', 90)
  await page.waitForTimeout(600)
  out.veniceWhy = { toasts: (await snap()).toasts.map(t => t.txt), nextIn: await page.evaluate(() => window.__capy.venice.nextIn('acqua-alta')) }
  await page.evaluate(() => { window.__capy.venice.phaseDebug(0.40) })
  const flood = { onsetAt: -1, samples: [], maxToasts: 0, momentFrames: 0, leavesMax: 0, placeLines: [] }
  out.flood = flood
  let momentRaised = false
  for (let i = 0; i < 140; i++) {
    await page.waitForTimeout(250)
    const sn = await snap()
    if (sn.err) { out.err = sn.err; break }
    if (sn.live >= 0 && flood.onsetAt < 0) { flood.onsetAt = sn.t; await shot('flood-onset') }
    if (flood.onsetAt >= 0) {
      const dt = sn.t - flood.onsetAt
      if (!momentRaised) { momentRaised = true; await page.evaluate(() => window.__capy.hud.showMoment('THE HERD', 'a tutorial card raised at the onset')) }
      if (dt <= 6.05) {
        flood.samples.push({ dt: +dt.toFixed(1), toasts: sn.toasts.length, moment: sn.moment, leaves: sn.leaves, line: sn.placeLine })
        if (sn.toasts.length > flood.maxToasts) flood.maxToasts = sn.toasts.length
        if (sn.moment) flood.momentFrames++
        if (sn.leaves > flood.leavesMax) { flood.leavesMax = sn.leaves; flood.leafNames = sn.leafNames }
        if (sn.placeLine && flood.placeLines.indexOf(sn.placeLine) < 0) flood.placeLines.push(sn.placeLine)
        if (dt > 2.4 && dt < 2.8) await shot('flood')
      } else if (dt > 6.05 && dt < 6.4) { await shot('flood-after'); }
      if (dt > 12) break
    }
  }
  out.tide = await page.evaluate(() => window.__capy.venice.tideAudit())
  out.toastAudit2 = await page.evaluate(() => window.__capy.hud.toastAudit())
  await page.waitForTimeout(4000)

  // ---- HANOI: the arrival frame ---------------------------------------------
  await page.evaluate(() => { window.__capy.hud.cross('hanoi') })
  await page.waitForTimeout(9500)
  out.hanoiBiome = await page.evaluate(() => window.__capy.biome.current)
  out.hanoiArrive = await paper()
  await shot('hanoi-arrive')
  out.errEnd = await page.evaluate(() => window.__capy.state.lastError || null)
  await post()
}
