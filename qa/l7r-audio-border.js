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
        const an = this.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0
        n.connect(an)
        window.__tap = { an: an, comp: n, ac: this }
      }
      return n
    }
  })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(9000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const out = { errs, started: await page.evaluate(() => window.__capy.state.started) }
  await page.evaluate(() => {
    const g = window.__capy, t = window.__tap
    const B = g.hud.audioBus()
    window.__stems = {}
    const mk = (node) => { const an = t.ac.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0; node.connect(an); return an }
    try { window.__stems.music = mk(g.music.taps.vol) } catch (e) {}
    try { window.__stems.world = mk(B.sfxOut) } catch (e) {}
    window.__sfxLog = []
    const o = g.sfx
    g.sfx = function (name, opts) { if (window.__sfxLog.length < 600) window.__sfxLog.push([+(performance.now() / 1000).toFixed(2), name]); return o.apply(this, arguments) }
  })
  // ---- 1. the border, at 100 ms: music and world through a real crossing ----
  const timeline = (secs, doAt, doFn) => page.evaluate(async ([secs, doAt, doFn]) => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const t = window.__tap, S = window.__stems, g = window.__capy
    const ans = { m: S.music, w: S.world, x: t.an }
    const td = new Float32Array(2048)
    const rows = []
    const t0 = performance.now(); let did = false
    window.__sfxLog = []
    while (performance.now() - t0 < secs * 1000) {
      const el = (performance.now() - t0) / 1000
      if (!did && el >= doAt) { did = true; try { (new Function('g', doFn))(g) } catch (e) {} }
      const r = { t: +el.toFixed(1) }
      for (const k in ans) { const an = ans[k]; if (!an) continue; an.getFloatTimeDomainData(td); let a2 = 0; for (let i = 0; i < td.length; i++) a2 += td[i] * td[i]; r[k] = +(10 * Math.log10(Math.max(1e-12, a2 / td.length))).toFixed(1) }
      try { const m = g.musAudit(); r.pal = m.pal; r.duck = m.duck; r.busy = m.busy ? 1 : 0 } catch (e) {}
      r.b = g.biome.current
      try { r.mv = g.hud.moverAudit().rows.filter(x => x.live).map(x => x.key + ':' + x.gain.toFixed(2)).join(' ') } catch (e) {}
      rows.push(r)
      await sleep(100)
    }
    return { rows, sfx: window.__sfxLog }
  }, [secs, doAt, doFn])
  out.crossSydneyToKyoto = await timeline(16, 2, "g.hud.cross('kyoto')")
  await page.waitForTimeout(4000)
  out.crossKyotoToVenice = await timeline(16, 2, "g.hud.cross('venice')")
  await page.waitForTimeout(4000)
  // ---- 2. the ladder of materials, and the wet, heard alone on the world bus ----
  out.steps = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const g = window.__capy, t = window.__tap, ac = t.ac
    const B = g.hud.audioBus()
    // mute the beds and the score for the ladder: tap sfxOut but the beds are in it, so read each hit as a difference over the floor
    try { g.music.setMuted && g.music.setMuted(true) } catch (e) {}
    const an = ac.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0; B.sfxOut.connect(an)
    const N = an.frequencyBinCount, hz = i => i * ac.sampleRate / an.fftSize
    const f = new Float32Array(N), td = new Float32Array(2048)
    const floor = () => { an.getFloatTimeDomainData(td); let a2 = 0; for (let i = 0; i < td.length; i++) a2 += td[i] * td[i]; return a2 / td.length }
    const one = async (mat, wet, pitch) => {
      let fl = 0; for (let i = 0; i < 5; i++) { fl += floor(); await sleep(20) } fl /= 5
      const res = { mat, wet, pk: 0, cw: 0, cs: 0, dur: 0, over: 0, b: [0, 0, 0, 0, 0] }
      g.sfx('step', { pitch: pitch || 1, volume: 1, wet: wet || 0, mat })
      const t0 = performance.now()
      while (performance.now() - t0 < 400) {
        an.getFloatTimeDomainData(td); an.getFloatFrequencyData(f)
        let a2 = 0; for (let i = 0; i < td.length; i++) a2 += td[i] * td[i]; a2 /= td.length
        if (a2 > fl * 3) { res.over++; res.dur = performance.now() - t0 }
        if (a2 > res.pk) res.pk = a2
        if (a2 > fl * 3) for (let i = 1; i < N; i++) { const h = hz(i); if (h < 60 || h > 16000) continue; const q = Math.pow(10, f[i] / 10); res.cw += q * h; res.cs += q; res.b[h < 300 ? 0 : h < 1000 ? 1 : h < 2500 ? 2 : h < 5000 ? 3 : 4] += q }
        await sleep(10)
      }
      const tot = res.b.reduce((x, y) => x + y, 0) || 1
      return { mat, wet, cent: Math.round(res.cw / Math.max(1e-12, res.cs)), pkDb: +(10 * Math.log10(Math.max(1e-12, res.pk))).toFixed(1), floorDb: +(10 * Math.log10(Math.max(1e-12, fl))).toFixed(1), durMs: Math.round(res.dur), bands: res.b.map(v => +(v / tot * 100).toFixed(0)) }
    }
    const rows = []
    for (const mat of ['grass', 'sand', 'gravel', 'stone', 'timber', 'metal', 'snow', 'ice']) { rows.push(await one(mat, 0)); await sleep(250) }
    rows.push(await one('sand', 1)); await sleep(250)
    rows.push(await one('stone', 1)); await sleep(250)
    rows.push(await one('grass', 0.5)); await sleep(250)
    try { g.music.setMuted && g.music.setMuted(false) } catch (e) {}
    return rows
  })
  // ---- 3. what does the sound TELL: which events carry a cue ----
  out.cues = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const g = window.__capy
    const fire = async (label, fn) => {
      window.__sfxLog = []
      const m0 = g.musAudit()
      try { fn() } catch (e) { return { label, err: String(e).slice(0, 80) } }
      await sleep(900)
      const m1 = g.musAudit()
      return { label, sfx: window.__sfxLog.map(r => r[1]), sting: m1.stingEnv, chaseT: m1.chaseT, ui: g.hud.uiSfxAudit ? g.hud.uiSfxAudit() : null }
    }
    const rows = []
    rows.push(await fire('npc:chase (authority)', () => g.events.emit('npc:chase', { authority: true })))
    await sleep(1500); g.events.emit('npc:lost', {}); await sleep(2500)
    rows.push(await fire('npc:denied', () => g.events.emit('npc:denied', {})))
    rows.push(await fire('npc:lost', () => g.events.emit('npc:lost', {})))
    rows.push(await fire('npc:caught', () => g.events.emit('npc:caught', { x: 0, z: 0 })))
    rows.push(await fire('task:done', () => g.events.emit('task:done', { id: 'probe' })))
    rows.push(await fire('capy:wheek', () => g.events.emit('capy:wheek', { x: 0, z: 0 })))
    rows.push(await fire('record', () => g.music.sting && g.music.sting('record')))
    rows.push(await fire('wowLive', () => g.wowLive('probe', 0.5)))
    rows.push(await fire('recordLive', () => g.recordLive && g.recordLive('probe', 'window 30 s')))
    rows.push(await fire('weather:thunder', () => g.events.emit('weather:thunder', {})))
    rows.push(await fire('biome:exitzone', () => g.events.emit('biome:exit', {})))
    rows.push(await fire('marqueeWhy', () => g.marqueeWhy && g.marqueeWhy()))
    return rows
  })
  // what events exist that a sound could answer: the emit census, from the page
  out.errsN = errs.length
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l7r-audio-border.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
