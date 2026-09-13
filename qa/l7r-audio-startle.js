async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(9000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const out = { errs, started: await page.evaluate(() => window.__capy.state.started), ch: {} }
  await page.evaluate(() => {
    const g = window.__capy
    window.__ev = {}
    for (const n of ['npc:startled', 'npc:chase', 'npc:lost', 'npc:caught', 'npc:calm', 'npc:denied', 'capy:wheek', 'prop:water', 'npc:splash']) g.events.on(n, () => { window.__ev[n] = (window.__ev[n] || 0) + 1 })
    // the drum stem, so the pulse can be heard rather than counted
    const ac = g.hud.audioBus().sfxOut.context
    const an = ac.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0
    try { g.music.taps.drum.connect(an) } catch (e) {}
    window.__drum = an
  })
  const watch = (secs) => page.evaluate(async (secs) => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const g = window.__capy
    const m0 = g.musAudit(), ev0 = Object.assign({}, window.__ev)
    const td = new Float32Array(2048); let s2 = 0, n = 0, over = 0
    const chaseTs = []
    const t0 = performance.now()
    while (performance.now() - t0 < secs * 1000) {
      window.__drum.getFloatTimeDomainData(td); let a2 = 0; for (let i = 0; i < td.length; i++) a2 += td[i] * td[i]; a2 /= td.length; s2 += a2; n++
      if (10 * Math.log10(Math.max(1e-12, a2)) > -45) over++
      const m = g.musAudit(); chaseTs.push(+m.chaseT.toFixed(1))
      await sleep(100)
    }
    const m1 = g.musAudit()
    const ev = {}; for (const k in window.__ev) { const d = window.__ev[k] - (ev0[k] || 0); if (d) ev[k] = d }
    // is anyone actually chasing?
    let chasing = 0, near = 0
    try { const rows = g.hud.npcAudit ? g.hud.npcAudit() : null; if (rows && rows.rows) for (const r of rows.rows) { if (r.state === 'chase') chasing++ } } catch (e) {}
    return { chaseHits: m1.chaseHits - m0.chaseHits, ev, drumRms: +(10 * Math.log10(Math.max(1e-12, s2 / Math.max(1, n)))).toFixed(1), drumAudibleShare: +(over / Math.max(1, n)).toFixed(2), chaseTmax: Math.max(...chaseTs), chaseTon: +(chaseTs.filter(v => v > 0).length / chaseTs.length).toFixed(2), chasing, calm: +g.calm().toFixed(2), chaos: +((g.state && g.state.chaos) || 0).toFixed(2), speakN: m1.speakN - m0.speakN }
  }, secs)
  for (const ch of ['sydney', 'kyoto', 'venice', 'palawan']) {
    if (ch !== 'sydney') { await page.evaluate((c) => window.__capy.hud.cross(c), ch); await page.waitForTimeout(9000) }
    const row = { biome: await page.evaluate(() => window.__capy.biome.current) }
    row.standA = await watch(15)
    row.standB = await watch(15)
    // a walk through the square: real keys, no wheek, no grab
    const wp = watch(15); await page.keyboard.down('KeyW'); await page.waitForTimeout(6000); await page.keyboard.up('KeyW'); await page.keyboard.down('KeyA'); await page.keyboard.down('KeyW'); await page.waitForTimeout(3000); await page.keyboard.up('KeyA'); await page.waitForTimeout(5500); await page.keyboard.up('KeyW'); row.walk = await wp
    out.ch[ch] = row
  }
  out.errsN = errs.length
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l7r-audio-startle.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
