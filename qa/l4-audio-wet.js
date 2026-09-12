async page => {
  // l4-audio-wet: does distance have wetness? A `thud` placed 3 m and 50 m to
  // the right of the ear in Sơn Đoòng (the wettest room in the game), heard as
  // the ear hears it: the effects bus (dry one-shots) summed with the room's
  // return (hud.audioBus().sfxIn + .roomOut into one ScriptProcessor), the
  // weather bed and the drips out of the way. Per shot: energy in the first
  // 100 ms after onset and energy 0.4–1.5 s after it; the ratio is the
  // direct-to-reverberant balance, and far/near is the number. Before the
  // per-call send the ratio was the same at both distances by construction.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) })
  await page.setViewportSize({ width: 1200, height: 700 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  await page.keyboard.press('Quote')          // chapter 16, Sơn Đoòng
  await page.waitForTimeout(12000)
  const setup = await page.evaluate(() => {
    const g = window.__capy
    if (g.hud.setMusicVolume) g.hud.setMusicVolume(0, true)
    // the drips are one-shots on the same bus as the thud; off for the measure
    try {
      const W = g.weather, row = W.rowOf(g.biome.current)
      const bed = {}; for (const k in row.bed) bed[k] = row.bed[k]; bed.drip = 0; bed.rain = 0
      W.set(g.biome.current, { bed: bed, rain: { odds: 0, peak: 0, hold: 1, gap: 999 } })
    } catch (e) {}
    const B = g.hud.audioBus()
    const ac = B.ac
    const N = ac.sampleRate * 4 | 0
    const ring = new Float32Array(N)
    let head = 0
    const sp = ac.createScriptProcessor(1024, 2, 1)
    sp.onaudioprocess = e => {
      const L = e.inputBuffer.getChannelData(0)
      const R = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : L
      for (let i = 0; i < L.length; i++) { ring[head] = 0.5 * (L[i] + R[i]); head = (head + 1) % N }
    }
    const sink = ac.createGain(); sink.gain.value = 0
    B.sfxIn.connect(sp); B.roomOut.connect(sp); sp.connect(sink); sink.connect(ac.destination)
    window.__tap = { ac, ring, N, get head() { return head }, sp }
    return { biome: g.biome.current, roomSend: g.hud.mixAudit ? g.hud.mixAudit().roomSend : null }
  })
  const shot = (d) => page.evaluate(async (d) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    const g = window.__capy, T = window.__tap, sr = T.ac.sampleRate
    const e = g.camera.matrixWorld.elements
    const p = g.hud.audioProbe(0, 0, 0)
    const ear = p.ear
    const at = { x: ear.x + e[0] * d, y: g.capy.position.y, z: ear.z + e[2] * d }
    const probe = g.hud.audioProbe(at.x, at.y, at.z)
    const pre = 0.15, post = 1.75
    await sleep(80)
    const h0 = T.head
    // volume 2 (the cap): the ratio is level-free and the far shot has to clear the room's own tail
    g.sfx('thud', { at: at, force: true, volume: 2 })
    await sleep((pre + post) * 1000 + 250)
    const preN = (pre * sr) | 0
    const buf = new Float32Array(((pre + post) * sr) | 0)
    for (let i = 0; i < buf.length; i++) buf[i] = T.ring[(h0 - preN + i + T.N) % T.N]
    const W = (0.004 * sr) | 0, nw = (buf.length / W) | 0
    const pw = new Float64Array(nw)
    for (let w = 0; w < nw; w++) { let s = 0; for (let i = 0; i < W; i++) { const v = buf[w * W + i]; s += v * v } pw[w] = s / W }
    const preW = (preN / W) | 0
    let floor = 0; for (let w = 0; w < preW; w++) floor += pw[w]; floor /= Math.max(1, preW)
    let peak = 0, peakW = 0; for (let w = preW; w < nw; w++) if (pw[w] > peak) { peak = pw[w]; peakW = w }
    let onset = peakW; for (let w = preW; w <= peakW; w++) if (pw[w] - floor > 0.1 * (peak - floor)) { onset = w; break }
    const E = (a, b) => { let s = 0; for (let w = onset + ((a / 0.004) | 0); w < Math.min(nw, onset + ((b / 0.004) | 0)); w++) s += Math.max(0, pw[w] - floor); return s }
    const head = E(0, 0.1), tail = E(0.4, 1.5)
    return { d: d, gain: +probe.gain.toFixed(3), wet: probe.wet, roomWet: probe.roomWet, lp: probe.lp, dist: probe.dist,
             peakDb: +(10 * Math.log10(Math.max(1e-12, peak))).toFixed(1), floorDb: +(10 * Math.log10(Math.max(1e-12, floor))).toFixed(1),
             ratio: +(tail / Math.max(1e-18, head)).toFixed(4) }
  }, d)
  const out = { setup, near: [], far: [], errs }
  // seven seconds apart: the cave's tail is five and a half, and the previous
  // shot's room is the floor the next one is measured against
  for (let k = 0; k < 5; k++) { out.near.push(await shot(3)); await page.waitForTimeout(5000); out.far.push(await shot(50)); await page.waitForTimeout(5000) }
  const med = a => { const v = a.filter(x => x.floorDb < -62 && x.peakDb > -60 && x.peakDb - x.floorDb > 25).map(x => x.ratio).sort((p, q) => p - q); return v.length ? v[v.length >> 1] : null }
  out.nearRatio = med(out.near); out.farRatio = med(out.far)
  out.farOverNear = out.nearRatio && out.farRatio ? +(out.farRatio / out.nearRatio).toFixed(2) : null
  await page.evaluate((o) => fetch('/shot?name=l4-audio-wet.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
