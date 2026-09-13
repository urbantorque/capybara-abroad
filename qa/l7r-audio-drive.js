async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => {
    try { localStorage.clear() } catch (e) {}
    const AC = window.AudioContext || window.webkitAudioContext
    const orig = AC.prototype.createDynamicsCompressor
    AC.prototype.createDynamicsCompressor = function () {
      const n = orig.call(this)
      if (!window.__tap) {
        const an = this.createAnalyser(); an.fftSize = 4096; an.smoothingTimeConstant = 0
        n.connect(an)
        window.__tap = { an: an, comp: n, ac: this }
      }
      return n
    }
  })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(9000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const out = { errs, started: await page.evaluate(() => window.__capy.state.started), ch: {} }
  await page.evaluate(() => {
    const g = window.__capy, t = window.__tap
    const B = g.hud.audioBus()
    window.__stems = {}
    const mk = (node) => { const an = t.ac.createAnalyser(); an.fftSize = 4096; an.smoothingTimeConstant = 0; node.connect(an); return an }
    try { window.__stems.music = mk(g.music.taps.vol) } catch (e) {}
    try { window.__stems.world = mk(B.sfxOut) } catch (e) {}
    try { window.__stems.room = mk(B.roomOut) } catch (e) {}
    window.__sfxN = {}; window.__mats = {}; window.__sfxLog = []; window.__placed = 0; window.__calls = 0
    const o = g.sfx
    g.sfx = function (name, opts) {
      window.__calls++
      window.__sfxN[name] = (window.__sfxN[name] || 0) + 1
      if (name === 'step' && opts) window.__mats[opts.mat || ('pitch:' + (opts.pitch || 1))] = (window.__mats[opts.mat || ('pitch:' + (opts.pitch || 1))] || 0) + 1
      // placed: an `at`, or a rec with a group/position (npc.js passes the person)
      const placed = !!(opts && (opts.at || opts.position || (opts.group && opts.group.position) || (opts.x !== undefined && opts.z !== undefined)))
      if (placed) window.__placed++
      if (window.__sfxLog.length < 1200) window.__sfxLog.push([+(performance.now() / 1000).toFixed(2), name, placed ? 1 : 0])
      return o.apply(this, arguments)
    }
    try { g.hud.ambAudit(true) } catch (e) {}
  })
  const meter = (secs) => page.evaluate(async (secs) => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const t = window.__tap, ac = t.ac, S = window.__stems
    const ans = { master: t.an, music: S.music, world: S.world, room: S.room }
    const N = t.an.frequencyBinCount, hz = i => i * ac.sampleRate / t.an.fftSize
    const acc = {}
    for (const k in ans) acc[k] = { f: new Float32Array(N), td: new Float32Array(t.an.fftSize), s2: 0, n: 0, pk: 0, cw: 0, cs: 0, b: [0, 0, 0, 0, 0], ws2: 0, wn: 0, perSec: [], crest: 0, tr: 0, hist: [] }
    let red = 0, sec = 0, mv = 0
    const t0 = performance.now(), g = window.__capy
    const dop = {}
    while (performance.now() - t0 < secs * 1000) {
      for (const k in ans) {
        const a = acc[k], an = ans[k]; if (!an) continue
        an.getFloatTimeDomainData(a.td); an.getFloatFrequencyData(a.f)
        let a2 = 0, p = 0
        for (let i = 0; i < a.td.length; i++) { const v = a.td[i]; a2 += v * v; const q = v < 0 ? -v : v; if (q > p) p = q }
        const fr = a2 / a.td.length
        a.s2 += fr; a.n++; if (p > a.pk) a.pk = p; a.ws2 += fr; a.wn++
        if (fr > 1e-9) a.crest += 20 * Math.log10(p / Math.sqrt(fr))
        if (a.hist.length >= 5) { const m = a.hist.reduce((x, y) => x + y, 0) / a.hist.length; if (fr > m * 4) a.tr++ }
        a.hist.push(fr); if (a.hist.length > 5) a.hist.shift()
        for (let i = 1; i < N; i++) { const h = hz(i); if (h < 20 || h > 20000) continue; const q = Math.pow(10, a.f[i] / 10); a.cw += q * h; a.cs += q; a.b[h < 120 ? 0 : h < 500 ? 1 : h < 2000 ? 2 : h < 5000 ? 3 : 4] += q }
      }
      if (t.comp.reduction < -1) red++
      try { const m = g.hud.moverAudit(); if (m.live > mv) mv = m.live; for (const r of m.rows) if (r.live) { const d = dop[r.key] || (dop[r.key] = { n: 0, gmax: 0, rateMin: 9, rateMax: 0 }); d.n++; if (r.gain > d.gmax) d.gmax = r.gain; if (r.rate !== undefined) { if (r.rate < d.rateMin) d.rateMin = r.rate; if (r.rate > d.rateMax) d.rateMax = r.rate } } } catch (e) {}
      const s = Math.floor((performance.now() - t0) / 1000)
      if (s !== sec) { for (const k in ans) { const a = acc[k]; a.perSec.push(+(10 * Math.log10(Math.max(1e-12, a.ws2 / Math.max(1, a.wn)))).toFixed(1)); a.ws2 = 0; a.wn = 0 } sec = s }
      await sleep(50)
    }
    const res = { red, moversMax: mv, dop }
    for (const k in ans) { const a = acc[k]; if (!ans[k]) continue; const tot = a.b.reduce((x, y) => x + y, 0); res[k] = { rms: +(10 * Math.log10(Math.max(1e-12, a.s2 / Math.max(1, a.n)))).toFixed(1), pk: +(20 * Math.log10(Math.max(1e-6, a.pk))).toFixed(1), cent: Math.round(a.cw / Math.max(1e-12, a.cs)), crest: +(a.crest / Math.max(1, a.n)).toFixed(1), trPerS: +(a.tr / secs).toFixed(2), sub: +(a.b[0] / tot * 100).toFixed(1), low: +(a.b[1] / tot * 100).toFixed(1), mid: +(a.b[2] / tot * 100).toFixed(1), hi: +(a.b[3] / tot * 100).toFixed(2), top: +(a.b[4] / tot * 100).toFixed(3), perSec: a.perSec } }
    return res
  }, secs)
  const k = page.keyboard
  const drive = async (secs) => {
    const t0 = Date.now()
    let i = 0
    while (Date.now() - t0 < secs * 1000) {
      const r = i % 8
      if (r === 0) { await k.down('KeyW'); await page.waitForTimeout(2600); await k.up('KeyW') }
      else if (r === 1) { await k.down('KeyW'); await k.down('KeyA'); await page.waitForTimeout(1400); await k.up('KeyA'); await page.waitForTimeout(1200); await k.up('KeyW') }
      else if (r === 2) { await k.press('Space'); await page.waitForTimeout(900); await k.press('KeyQ'); await page.waitForTimeout(1500) }
      else if (r === 3) { await k.down('ShiftLeft'); await k.down('KeyW'); await page.waitForTimeout(2800); await k.up('KeyW'); await k.up('ShiftLeft') }
      else if (r === 4) { await k.press('KeyE'); await page.waitForTimeout(700); await k.down('KeyW'); await k.down('KeyD'); await page.waitForTimeout(1600); await k.up('KeyD'); await k.up('KeyW') }
      else if (r === 5) { await page.waitForTimeout(2200) }
      else if (r === 6) { await k.down('KeyW'); await page.waitForTimeout(1200); await k.press('Space'); await page.waitForTimeout(1200); await k.up('KeyW') }
      else { await k.down('KeyS'); await page.waitForTimeout(900); await k.up('KeyS'); await k.press('KeyE'); await page.waitForTimeout(800) }
      i++
    }
  }
  const chapters = ['sydney', 'hanoi', 'antarctic']
  for (const ch of chapters) {
    if (ch !== 'sydney') { await page.evaluate((c) => window.__capy.hud.cross(c), ch); await page.waitForTimeout(9000) }
    await page.evaluate(() => { window.__sfxN = {}; window.__mats = {}; window.__sfxLog = []; window.__placed = 0; window.__calls = 0; try { window.__capy.hud.ambAudit(true) } catch (e) {} })
    const row = { biome: await page.evaluate(() => window.__capy.biome.current) }
    row.still = await meter(12)
    row.drive = []
    for (let s = 0; s < 8; s++) { const mp = meter(19); await drive(19); row.drive.push(await mp) }
    row.after = await page.evaluate(() => {
      const g = window.__capy
      let amb = null, mov = null, mix = null, mus = null
      try { amb = g.hud.ambAudit() } catch (e) {}
      try { mov = g.hud.moverAudit() } catch (e) {}
      try { mix = g.hud.mixAudit() } catch (e) {}
      try { mus = g.musAudit() } catch (e) {}
      // per-minute distinct names, from the log
      const L = window.__sfxLog, t0 = L.length ? L[0][0] : 0
      const perMin = [new Set(), new Set(), new Set()]
      for (const r of L) { const m = Math.min(2, Math.floor((r[0] - t0) / 60)); perMin[m].add(r[1]) }
      const nonStep = L.filter(r => r[1] !== 'step')
      return { sfx: window.__sfxN, distinct: Object.keys(window.__sfxN).length, mats: window.__mats, calls: window.__calls, placed: window.__placed,
               placedShare: +(window.__placed / Math.max(1, window.__calls)).toFixed(2), nonStepN: nonStep.length, nonStepPlaced: nonStep.filter(r => r[2]).length,
               distinctPerMin: perMin.map(s => s.size), namesPerMin: perMin.map(s => Array.from(s).join(',')),
               amb: amb && amb.tally, ambN: amb && amb.total, movers: mov && mov.rows.filter(r => r.live).map(r => r.key + ':' + r.gain.toFixed(2)),
               uiSfx: (() => { try { return g.hud.uiSfxAudit() } catch (e) { return null } })(),
               voiceDrops: mix && mix.voiceDrops, threw: mix && mix.synthThrew, prog: mus && mus.chapProg, secondN: mus && mus.secondN, cells: mus && mus.melCells, speakN: mus && mus.speakN,
               pos: g.capy ? [+g.capy.position.x.toFixed(0), +g.capy.position.z.toFixed(0)] : null, err: g.state.lastError || null }
    })
    out.ch[ch] = row
  }
  out.errsN = errs.length
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l7r-audio-drive.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
