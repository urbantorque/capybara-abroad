async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
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
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(5000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const out = { errs, started: await page.evaluate(() => window.__capy.state.started) }
  // (1) THE THEME: the arrival phrase's notes and intervals in all 21 palettes
  out.phrase = await page.evaluate(() => {
    const g = window.__capy, rows = []
    const cur = g.musAudit().pal
    for (let n = 0; n < 21; n++) {
      try {
        const r = g.hud.phraseAudit(n)
        const iv = []; for (let i = 1; i < r.notes.length; i++) iv.push(r.notes[i] - r.notes[i - 1])
        rows.push({ pal: n, notes: r.notes, iv: iv.join(','), ok: r.ok, inst: r.inst, second: r.second, chord: r.chord })
      } catch (e) { rows.push({ pal: n, err: String(e) }) }
    }
    try { g.hud.phraseAudit(cur) } catch (e) {}
    return rows
  })
  await page.waitForTimeout(1500)
  await page.evaluate(() => {
    const g = window.__capy, t = window.__tap, B = g.hud.audioBus()
    window.__stems = {}
    const mk = (node) => { const an = t.ac.createAnalyser(); an.fftSize = 4096; an.smoothingTimeConstant = 0; node.connect(an); return an }
    try { window.__stems.music = mk(g.music.taps.vol) } catch (e) {}
    try { window.__stems.world = mk(B.sfxOut) } catch (e) {}
    try { window.__stems.room = mk(B.roomOut) } catch (e) {}
    try { window.__stems.mroom = mk(g.music.taps.wet) } catch (e) {}
  })
  const meter = (secs) => page.evaluate(async (secs) => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const t = window.__tap, S = window.__stems
    const ans = { master: t.an, music: S.music, world: S.world, room: S.room, mroom: S.mroom }
    const acc = {}
    for (const k in ans) acc[k] = { td: new Float32Array(t.an.fftSize), s2: 0, n: 0, pk: 0, ws2: 0, wn: 0, perHalf: [] }
    let sec = 0
    const t0 = performance.now()
    while (performance.now() - t0 < secs * 1000) {
      for (const k in ans) {
        const a = acc[k], an = ans[k]; if (!an) continue
        an.getFloatTimeDomainData(a.td)
        let a2 = 0, p = 0
        for (let i = 0; i < a.td.length; i++) { const v = a.td[i]; a2 += v * v; const q = v < 0 ? -v : v; if (q > p) p = q }
        a.s2 += a2 / a.td.length; a.n++; if (p > a.pk) a.pk = p; a.ws2 += a2 / a.td.length; a.wn++
      }
      const s = Math.floor((performance.now() - t0) / 500)
      if (s !== sec) { for (const k in ans) { const a = acc[k]; a.perHalf.push(+(10 * Math.log10(Math.max(1e-12, a.ws2 / Math.max(1, a.wn)))).toFixed(1)); a.ws2 = 0; a.wn = 0 } sec = s }
      await sleep(40)
    }
    const res = {}
    for (const k in ans) { const a = acc[k]; if (!ans[k]) continue; res[k] = { rms: +(10 * Math.log10(Math.max(1e-12, a.s2 / Math.max(1, a.n)))).toFixed(1), pk: +(20 * Math.log10(Math.max(1e-6, a.pk))).toFixed(1), perHalf: a.perHalf } }
    const g = window.__capy; try { const r = g.hud.roomAudit(); res.roomKey = r.key + ':' + (+r.wet.toFixed(2)) } catch (e) {}
    return res
  }, secs)
  // (2) THE ROOM: world vs room return, still and on a wheek, in five rooms
  out.rooms = {}
  for (const ch of ['sydney', 'kyoto', 'venice', 'hanoi', 'cave']) {
    if (ch !== 'sydney') {
      const xp = meter(16)
      await page.evaluate((c) => window.__capy.hud.cross(c), ch)
      out.rooms[ch + ':cross'] = await xp
      await page.waitForTimeout(2000)
    }
    const row = { still: await meter(6) }
    const wp = meter(4)
    await page.waitForTimeout(300); await page.keyboard.press('KeyQ'); await page.waitForTimeout(1200); await page.keyboard.press('KeyQ')
    row.wheek = await wp
    out.rooms[ch] = row
  }
  // (3) THE STINGS against the bed, and the lift
  await page.evaluate(() => window.__capy.hud.setSfxVolume(0, true))
  await page.waitForTimeout(1500)
  out.bed = await meter(6)
  out.stings = {}
  for (const s of ['arrive', 'record', 'done', 'keep', 'act', 'wear']) {
    const p = meter(3); await page.waitForTimeout(150)
    const n = await page.evaluate((s) => window.__capy.hud.stingAudit(s), s)
    out.stings[s] = Object.assign({ notes: n }, await p)
    await page.waitForTimeout(2500)
  }
  const lp = meter(6); await page.waitForTimeout(200); await page.evaluate(() => window.__capy.music.swell(1)); out.lift = await lp
  out.errsN = errs.length
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6r-audio-theme.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
