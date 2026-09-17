async page => {
  // EVENT OVER FLOOR (L7, E1 / audio #2). The reviewer's transient rate is a frame whose power is 4x the
  // mean of the previous five (a +6 dB jump over ~250 ms) on the master. This asks the question underneath
  // it: for each sfx() call while walking, how far does the world bus and the master rise over the 250 ms
  // before it? Per chapter: 20 s walking, 40 ms frames on master / music / world, the sfx log with times.
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
  const out = { errs, started: await page.evaluate(() => window.__capy.state.started), ch: {} }
  await page.evaluate(() => {
    const g = window.__capy, t = window.__tap
    const B = g.hud.audioBus()
    window.__stems = {}
    const mk = (node) => { const an = t.ac.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0; node.connect(an); return an }
    try { window.__stems.music = mk(g.music.taps.vol) } catch (e) {}
    try { window.__stems.world = mk(B.sfxOut) } catch (e) {}
    window.__sfxLog = []
    const o = g.sfx
    g.sfx = function (name, opts) {
      if (window.__sfxLog.length < 3000) window.__sfxLog.push([performance.now(), name, opts && opts.volume !== undefined ? +opts.volume.toFixed(2) : null])
      return o.apply(this, arguments)
    }
  })
  const meter = (secs) => page.evaluate(async (secs) => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const t = window.__tap, S = window.__stems, g = window.__capy
    const ans = { master: t.an, music: S.music, world: S.world }
    const td = new Float32Array(t.an.fftSize)
    const fr = { master: [], music: [], world: [] }, ts = []
    window.__sfxLog.length = 0
    const t0 = performance.now()
    while (performance.now() - t0 < secs * 1000) {
      ts.push(performance.now())
      for (const k in ans) {
        ans[k].getFloatTimeDomainData(td)
        let a2 = 0; for (let i = 0; i < td.length; i++) a2 += td[i] * td[i]
        fr[k].push(a2 / td.length)
      }
      await sleep(40)
    }
    // per event: the max frame in the 200 ms after the call minus the mean of the 250 ms before, per stem
    const ev = []
    for (const e of window.__sfxLog) {
      const at = e[0]
      let i0 = -1; for (let i = 0; i < ts.length; i++) if (ts[i] >= at) { i0 = i; break }
      if (i0 < 7 || i0 + 5 >= ts.length) continue
      const row = { name: e[1], vol: e[2] }
      for (const k in fr) {
        let pre = 0; for (let i = i0 - 6; i < i0; i++) pre += fr[k][i]; pre /= 6
        let post = 0; for (let i = i0; i < i0 + 5; i++) if (fr[k][i] > post) post = fr[k][i]
        row[k] = +(10 * Math.log10(Math.max(1e-12, post) / Math.max(1e-12, pre))).toFixed(1)
        row[k + 'Pk'] = +(10 * Math.log10(Math.max(1e-12, post))).toFixed(1)
      }
      ev.push(row)
    }
    const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null
    const rms = (k) => +(10 * Math.log10(Math.max(1e-12, mean(fr[k])))).toFixed(1)
    const byName = {}
    for (const r of ev) { const b = byName[r.name] || (byName[r.name] = { n: 0, world: [], master: [], worldPk: [], masterPk: [] }); b.n++; b.world.push(r.world); b.master.push(r.master); b.worldPk.push(r.worldPk); b.masterPk.push(r.masterPk) }
    const summ = {}
    for (const k in byName) { const b = byName[k]; summ[k] = { n: b.n, worldRise: +mean(b.world).toFixed(1), masterRise: +mean(b.master).toFixed(1), worldPk: +mean(b.worldPk).toFixed(1), masterPk: +mean(b.masterPk).toFixed(1), masterOver6: b.master.filter(x => x >= 6).length } }
    // the reviewer's transient count on the master, same definition (5-frame history, 4x)
    let tr = 0; const h = fr.master
    for (let i = 5; i < h.length; i++) { let m = 0; for (let j = i - 5; j < i; j++) m += h[j]; m /= 5; if (h[i] > m * 4) tr++ }
    return { rms: { master: rms('master'), music: rms('music'), world: rms('world') }, frames: ts.length, events: ev.length, trPerS: +(tr / secs).toFixed(2), byName: summ,
             musAudit: (() => { const m = g.musAudit(); return { pad: m.pad, worldEnv: m.worldEnv, side: m.side, flow: m.flow, pluckDry: m.pluckDry } })(), err: g.state.lastError || null }
  }, secs)
  for (const ch of ['sydney', 'antarctic']) {
    if (ch !== 'sydney') { await page.evaluate((c) => window.__capy.hud.cross(c), ch); await page.waitForTimeout(9000) }
    const mp = meter(20)
    await page.keyboard.down('KeyW'); await page.waitForTimeout(6000); await page.keyboard.down('KeyA'); await page.waitForTimeout(3000); await page.keyboard.up('KeyA')
    await page.waitForTimeout(5000); await page.keyboard.press('Space'); await page.waitForTimeout(5500); await page.keyboard.up('KeyW')
    out.ch[ch] = await mp
  }
  out.errsN = errs.length
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l7-e1-events.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
