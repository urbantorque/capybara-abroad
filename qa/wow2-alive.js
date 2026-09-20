async page => {
  // ROADMAP-WOW2 V1 — THE ANIMAL, ALIVE. Sixty seconds at rest through an own
  // camera three metres off the animal, the animal's screen mask by
  // hide-and-diff, and the moved pixels per second INSIDE that mask, live
  // (the small clock, V1.1) against `noAlive`. The big idle table, the
  // breath and the blink run in both arms; the differential is the clock.
  // Eight idle moments are cropped into one contact sheet to be read by eye.
  // Then (V1.3) a walk on Palawan's sand and Antarctica's snow with the
  // footfall bursts counted per stride, live against `noFootfall`.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(9000)
  const out = { errs, rest: {}, sheet: [], footfall: {} }

  await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
    const ctx = c2.getContext('2d', { willReadFrequently: true })
    const w2 = window.__w2 = { W, H, c2, ctx, cam: null, mask: null, maskN: 0, box: null, prev: null,
                               samples: [], sheet: [], beats: [], lastAct: -1, sheetCanvas: null, blockN: 0, tail: 0 }
    w2.aim = function () {
      const p = g.capy.position
      const yaw = g.capy.group ? g.capy.group.rotation.y : 0
      // three metres off, forty degrees round from the nose, a metre up
      const a = yaw + 0.7
      const c = new T.PerspectiveCamera(36, W / H, 0.05, 400)
      c.position.set(p.x + Math.sin(a) * 3.0, p.y + 0.9, p.z + Math.cos(a) * 3.0)
      c.lookAt(p.x, p.y + 0.05, p.z); c.updateMatrixWorld()
      w2.cam = c
    }
    w2.grab = function () {
      g.renderer.setRenderTarget(null)
      g.renderer.render(g.scene, w2.cam)
      ctx.drawImage(g.renderer.domElement, 0, 0)
      return ctx.getImageData(0, 0, W, H).data
    }
    w2.buildMask = function () {
      const root = g.capy.model || g.capy.group
      const a = w2.grab()
      root.visible = false
      const b = w2.grab()
      root.visible = true
      const mask = new Uint8Array(W * H)
      let n = 0, x0 = W, x1 = 0, y0 = H, y1 = 0
      for (let i = 0; i < W * H; i++) {
        const j = i * 4
        const d = Math.max(Math.abs(a[j] - b[j]), Math.abs(a[j + 1] - b[j + 1]), Math.abs(a[j + 2] - b[j + 2]))
        if (d > 8) { mask[i] = 1; n++; const x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
      }
      w2.mask = mask; w2.maskN = n; w2.box = [x0, y0, x1, y1]
      w2.prev = w2.grab()
      return { maskPx: n, box: w2.box }
    }
    // One block of game time: `secs` at 60 Hz, a sample every `every` s.
    // `nudge` > 0: a tap of Space every that many seconds — a hop in place,
    // so the animal stays on its feet (the loaf lands at 6.5 s of rest) and
    // IN THE FRAME (a tap of W walked it out of a 3 m lens in two taps) —
    // the STANDING arm, where the weight shift and the turn are on the table.
    // The tap goes through the real keydown listener, which also wakes it.
    w2.run = function (secs, every, arm, nudge) {
      g.capy.wake(300)
      const steps = Math.round(every * 60)
      const N = Math.round(secs / every)
      const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code === 'Space' ? ' ' : code, bubbles: true }))
      let sinceNudge = nudge ? nudge - 1.5 : -1
      let moved = 0, movedQuiet = 0, quietSamples = 0
      const per = []
      for (let s = 0; s < N; s++) {
        if (nudge > 0) {
          sinceNudge += every
          if (sinceNudge >= nudge) { sinceNudge = 0; key('keydown', 'Space'); for (let k = 0; k < 8; k++) g.tick(1 / 60, false); key('keyup', 'Space') }
        }
        for (let k = 0; k < steps; k++) g.tick(1 / 60, false)
        const cur = w2.grab()
        const au = g.capy.aliveAudit ? g.capy.aliveAudit() : { act: -1, tableAct: -1 }
        let m = 0
        const mask = w2.mask, prev = w2.prev
        for (let i = 0; i < W * H; i++) {
          if (!mask[i]) continue
          const j = i * 4
          const d = Math.max(Math.abs(cur[j] - prev[j]), Math.abs(cur[j + 1] - prev[j + 1]), Math.abs(cur[j + 2] - prev[j + 2]))
          if (d > 8) m++
        }
        moved += m
        per.push(m)
        if (au.tableAct < 0) { movedQuiet += m; quietSamples++ }
        w2.prev = cur
        if (au.act !== w2.lastAct) {
          if (au.act >= 0) w2.beats.push({ arm, t: +(g.state.time).toFixed(2), act: au.act, peak: 0, block: w2.blockN })
          w2.lastAct = au.act
        }
        // the beat's own pixels: its highest sample (and the one after it,
        // the damp's tail), against the block's floor once that is known
        if (w2.beats.length && (au.act >= 0 || w2.tail > 0)) {
          const bt = w2.beats[w2.beats.length - 1]
          if (m > bt.peak) bt.peak = m
          w2.tail = au.act >= 0 ? 2 : w2.tail - 1
        }
        // the contact sheet: the middle of a beat, once per beat, eight at most
        if (arm.indexOf('cut') < 0 && au.act >= 0 && au.p > 0.35 && au.p < 0.7 && w2.sheet.length < 8 &&
            (!w2.sheet.length || w2.sheet[w2.sheet.length - 1].t !== w2.beats[w2.beats.length - 1].t)) {
          const b = w2.box, bw = b[2] - b[0] + 40, bh = b[3] - b[1] + 40
          const cc = document.createElement('canvas'); cc.width = bw; cc.height = bh
          cc.getContext('2d').drawImage(c2, b[0] - 20, b[1] - 20, bw, bh, 0, 0, bw, bh)
          w2.sheet.push({ t: w2.beats[w2.beats.length - 1].t, act: au.act, c: cc })
        }
      }
      // THE FLOOR AND THE EXCESS. The breath scales the whole squash node
      // and a blink is a face, so 6-9 % of the mask moves every sample in
      // BOTH arms; a beat is the samples over that floor. The median
      // per-sample count is the floor, the excess is what sits above it.
      const srt = per.slice().sort((a, b) => a - b), med = srt[srt.length >> 1]
      for (const bt of w2.beats) if (bt.block === w2.blockN) bt.delta = bt.peak - med
      w2.blockN++
      let excess = 0, peaks = 0
      for (const m of per) { if (m > med) excess += m - med; if (m > med * 1.6) peaks++ }
      return { arm, secs, moved, movedPerS: +(moved / secs).toFixed(0), floor: med, excessPerS: +(excess / secs).toFixed(0), peaks,
               quietPerS: quietSamples ? +(movedQuiet / (quietSamples * every)).toFixed(0) : null, quietSamples }
    }
    w2.sheetUrl = function () {
      const names = ['flick', 'shift', 'sniff', 'turn']
      const cw = 300, ch = 240
      const sc = document.createElement('canvas'); sc.width = cw * 4; sc.height = ch * 2
      const x = sc.getContext('2d'); x.fillStyle = '#222'; x.fillRect(0, 0, sc.width, sc.height)
      x.font = '16px sans-serif'; x.fillStyle = '#fff'
      w2.sheet.forEach((s, i) => {
        const ox = (i % 4) * cw, oy = (i >> 2) * ch
        const k = Math.min(cw / s.c.width, (ch - 24) / s.c.height)
        x.drawImage(s.c, ox, oy + 24, s.c.width * k, s.c.height * k)
        x.fillText(names[s.act] + '  t=' + s.t, ox + 6, oy + 17)
      })
      return sc.toDataURL('image/png')
    }
    w2.fullUrl = function () { w2.grab(); return c2.toDataURL('image/png') }
  })

  // ---- THE REST: sydney, live then cut, 30 s each in 10 s blocks ----------
  // let the animal settle first (the loaf lands at 6.5 s of rest), so the
  // mask is the pose the whole minute is measured in; the rung is pinned at
  // 0 through the prefs file (`pf: 1`, pretty) because the headless GL sits
  // at rung 3 on its own, which parks every rung-parked term in the game
  // ...and awake: the nap lands at 26 s of rest and takes every beat; a
  // person reading the map is pressing things, which is what wake() is
  out.rest.settle = await page.evaluate(() => { const g = window.__capy; g.capy.wake(300); for (let k = 0; k < 720; k++) g.tick(1 / 60, false); return { rung: g.state.perfRung, loaf: +g.capy.loaf.toFixed(2) } })
  out.rest.mask = await page.evaluate(() => { window.__w2.aim(); return window.__w2.buildMask() })
  const blocks = []
  for (const arm of ['live', 'cut', 'stand-live', 'stand-cut']) {
    await page.evaluate((arm) => { window.__capy.state.noAlive = arm.indexOf('cut') >= 0 }, arm)
    const nudge = arm.indexOf('stand') === 0 ? 8 : 0
    if (nudge) await page.evaluate(() => { window.__w2.aim(); window.__w2.buildMask() })
    for (let b = 0; b < 3; b++) blocks.push(await page.evaluate((o) => window.__w2.run(10, 0.1, o.arm, o.nudge), { arm, nudge }))
  }
  await page.evaluate(() => { window.__capy.state.noAlive = false })
  const sum = arm => { const rows = blocks.filter(r => r.arm === arm); const secs = rows.reduce((a, r) => a + r.secs, 0); const mv = rows.reduce((a, r) => a + r.moved, 0)
    const q = rows.filter(r => r.quietPerS !== null); return { secs, movedPerS: +(mv / secs).toFixed(0), quietPerS: q.length ? +(q.reduce((a, r) => a + r.quietPerS, 0) / q.length).toFixed(0) : null } }
  out.rest.live = sum('live'); out.rest.cut = sum('cut'); out.rest.standLive = sum('stand-live'); out.rest.standCut = sum('stand-cut')
  out.rest.ratio = out.rest.cut.movedPerS > 0 ? +(out.rest.live.movedPerS / out.rest.cut.movedPerS).toFixed(2) : null
  const ex = arm => { const rows = blocks.filter(r => r.arm === arm); return { excessPerS: +(rows.reduce((a, r) => a + r.excessPerS, 0) / rows.length).toFixed(0), peaks: rows.reduce((a, r) => a + r.peaks, 0), floor: +(rows.reduce((a, r) => a + r.floor, 0) / rows.length).toFixed(0) } }
  out.rest.excess = { live: ex('live'), cut: ex('cut'), standLive: ex('stand-live'), standCut: ex('stand-cut') }
  out.rest.excessRatio = out.rest.excess.cut.excessPerS > 0 ? +(out.rest.excess.live.excessPerS / out.rest.excess.cut.excessPerS).toFixed(2) : null
  out.rest.quietRatio = (out.rest.cut.quietPerS > 0 && out.rest.live.quietPerS !== null) ? +(out.rest.live.quietPerS / out.rest.cut.quietPerS).toFixed(2) : null
  out.rest.beats = await page.evaluate(() => window.__w2.beats)
  out.rest.blocks = blocks
  const sheetUrl = await page.evaluate(() => window.__w2.sheetUrl())
  await page.evaluate(async (u) => { await fetch('/shot?name=wow2-alive-sheet', { method: 'POST', body: u }) }, sheetUrl)
  out.sheet = await page.evaluate(() => window.__w2.sheet.map(s => ({ t: s.t, act: s.act })))
  const fullUrl = await page.evaluate(() => window.__w2.fullUrl())
  await page.evaluate(async (u) => { await fetch('/shot?name=wow2-alive-rest', { method: 'POST', body: u }) }, fullUrl)

  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-alive.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
