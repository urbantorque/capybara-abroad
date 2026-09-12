async page => {
  // l4r-audio-census: every chapter, 30 s standing still at the spawn after the
  // picker key (so the arrival phrase and the arrival shot are in it), master
  // tapped after the limiter. Per chapter: RMS/peak/centroid/band share, the
  // per-second RMS trace, distinct sfx names (game.sfx wrapper + ladder),
  // the room and the live movers. The question: do nineteen places sound like
  // nineteen places, or like one mix in nineteen keys?
  const keys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0',
                'Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash']
  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara', 'drift', 'venice',
                 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
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
  const out = {}
  for (let i = 0; i < names.length; i++) {
    const ch = names[i]
    await page.goto('http://localhost:5188/'); await page.waitForTimeout(4500)
    await page.evaluate(() => {
      const g = window.__capy; window.__sfxN = {}
      const o = g.sfx
      g.sfx = function (name, opts) { window.__sfxN[name] = (window.__sfxN[name] || 0) + 1; return o.apply(this, arguments) }
      try { g.hud.ambAudit(true) } catch (e) {}
    })
    await page.keyboard.press(keys[i])
    out[ch] = await page.evaluate(async () => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
      const t = window.__tap, ac = t.ac, an = t.an
      const N = an.frequencyBinCount, f = new Float32Array(N), td = new Float32Array(an.fftSize)
      const hz = i => i * ac.sampleRate / an.fftSize
      let s2 = 0, n = 0, pk = 0, cw = 0, cs = 0, lo = 0, mid = 0, hi = 0, top = 0, red = 0
      const t0 = performance.now(), rows = []
      let sec = 0, ws2 = 0, wn = 0
      while (performance.now() - t0 < 32000) {
        an.getFloatTimeDomainData(td); an.getFloatFrequencyData(f)
        let a2 = 0, p = 0
        for (let i = 0; i < td.length; i++) { const v = td[i]; a2 += v * v; const a = v < 0 ? -v : v; if (a > p) p = a }
        const started = performance.now() - t0 > 2000     // skip the white hold
        if (started) {
          s2 += a2 / td.length; n++; if (p > pk) pk = p; ws2 += a2 / td.length; wn++
          for (let i = 1; i < N; i++) { const q = Math.pow(10, f[i] / 10), h = hz(i); cw += q * h; cs += q; if (h < 250) lo += q; else if (h < 2000) mid += q; else if (h < 5000) hi += q; else top += q }
          if (t.comp.reduction < -1) red++
        }
        const s = Math.floor((performance.now() - t0) / 1000)
        if (s !== sec) { rows.push(+(20 * Math.log10(Math.max(1e-6, Math.sqrt(ws2 / Math.max(1, wn))))).toFixed(1)); ws2 = 0; wn = 0; sec = s }
        await sleep(40)
      }
      const rms = Math.sqrt(s2 / Math.max(1, n)), tot = lo + mid + hi + top
      const g = window.__capy
      let amb = null, mus = null, room = null, mov = null, mix = null
      try { amb = g.hud.ambAudit() } catch (e) {}
      try { mus = g.musAudit() } catch (e) {}
      try { room = g.hud.roomAudit() } catch (e) {}
      try { mov = g.hud.moverAudit() } catch (e) {}
      try { mix = g.hud.mixAudit() } catch (e) {}
      return { rms: +(20 * Math.log10(Math.max(1e-6, rms))).toFixed(1), pk: +(20 * Math.log10(Math.max(1e-6, pk))).toFixed(1),
               cent: Math.round(cw / Math.max(1e-12, cs)), lo: +(lo / tot * 100).toFixed(1), mid: +(mid / tot * 100).toFixed(1), hi: +(hi / tot * 100).toFixed(1), top: +(top / tot * 100).toFixed(2),
               red, perSec: rows, sfx: window.__sfxN, amb: amb && amb.tally, pal: mus && mus.pal, band: mus && mus.band, pad: mus && mus.pad, bass: mus && mus.bass,
               room: room && { key: room.key, wet: room.wet, secs: room.secs }, movers: mov && mov.rows.filter(r => r.live).map(r => r.key + ':' + r.gain.toFixed(2)),
               voiceDrops: mix && mix.voiceDrops, threw: mix && mix.synthThrew, state: ac.state, biome: g.biome && g.biome.current, err: g.state.lastError || null }
    })
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4r-audio-census.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
