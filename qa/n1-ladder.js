async page => {
  // n1-ladder: the chain's five named states on the pips, the amber turn
  // when somebody sets off, the tier card, and the welcome party at tier 4.
  // Two passes: a fresh save (rungs 2 → look, 4 → march) and a save seeded
  // to 'a legend' (rung 1 → look, 3 → march, the welcome on arrival).
  await page.setViewportSize({ width: 1200, height: 700 })
  const out = { fresh: null, legend: null }
  for (const mode of ['fresh', 'legend']) {
    await page.addInitScript((mode) => {
      try { localStorage.clear() } catch (e) {}
      if (mode === 'legend') {
        const inc = {}; for (let n = 1; n <= 12; n++) inc[n] = 4
        localStorage.setItem('capy3.journey.v1', JSON.stringify({ v: 1, tasks: ['take-tiller'], seen: [], recs: {}, ms: 0, chapms: {}, finds: [], inc: inc, scn: {}, told: 1, biome: 'sydney' }))
      }
    }, mode)
    await page.reload(); await page.waitForTimeout(4500)
    await page.keyboard.press('Digit1'); await page.waitForTimeout(3500)
    const res = { noto: await page.evaluate(() => window.__capy.notoDebug()) }
    await page.evaluate(() => { const g = window.__capy; try { g.hud.cross('goreme') } catch (e) { g.biome.switchTo('goreme') } })
    await page.waitForTimeout(4500)
    // the welcome, if any: who has wel > 0 and how near they get
    res.welcome = await page.evaluate(() => new Promise(res => {
      const g = window.__capy; const t0 = performance.now(); let best = 99, n = 0
      ;(function step() {
        const p = g.capy.position
        for (const r of g.locals) if (r.wel > 0) { n = Math.max(n, 1); const d = Math.hypot(p.x - r.x, p.z - r.z); if (d < best) best = d }
        let cnt = 0; for (const r of g.locals) if (r.wel > 0) cnt++; n = Math.max(n, cnt)
        if (performance.now() - t0 > 9000) res({ n: n, nearest: +best.toFixed(2), toast: (document.querySelector('.capyui-toasts') || {}).textContent || '' })
        else requestAnimationFrame(step)
      })()
    }))
    // ring the locals at 13 m
    await page.evaluate(() => {
      const g = window.__capy; const p = g.capy.position; const live = g.biome.current
      let k = 0, n = 0
      for (const r of g.locals) if (r.biome === live && r.group) n++
      for (const r of g.locals) {
        if (r.biome !== live || !r.group) continue
        const a = (k++ / Math.max(1, n)) * 6.283185
        r.x = p.x + Math.sin(a) * 13; r.z = p.z + Math.cos(a) * 13
        r.ax = r.x; r.az = r.z; r.tx = r.x; r.tz = r.z; r.wel = 0
        r.group.position.set(r.x, r.group.position.y, r.z)
        if (r.body) { r.body.position.x = r.x; r.body.position.z = r.z; r.body.aabbNeedsUpdate = true }
      }
    })
    await page.waitForTimeout(600)
    res.chain = await page.evaluate(() => new Promise(res => {
      const g = window.__capy
      let dropped = 0, nextDrop = 0; const t0 = performance.now()
      const labels = [], cards = []; let lastLbl = '', lastCard = '', marchAt = -1, warnAt = -1
      ;(function step() {
        const t = (performance.now() - t0) / 1000
        if (dropped < 5 && t >= nextDrop) {
          dropped++; nextDrop = t + 1.6
          const p = g.capy.position
          const pr = g.physics.spawnProp('cone', p.x + 1.4, p.z + 1.4)
          if (pr && pr.body) { pr.disturbed = true; pr.lastCapyTouch = g.state ? g.state.time : 0; pr.body.wakeUp(); pr.body.position.y += 2.4; pr.body.velocity.set(0, -6, 0) }
        }
        const pe = document.querySelector('.capyui-pips')
        const lbl = pe && pe.classList.contains('on') ? pe.querySelector('.capyui-pipslbl').textContent : ''
        if (lbl && lbl !== lastLbl) { lastLbl = lbl; labels.push(+t.toFixed(1) + ' ' + lbl + (pe.classList.contains('warn') ? ' [warn]' : '')) }
        if (pe && pe.classList.contains('warn') && warnAt < 0) warnAt = +t.toFixed(1)
        const m = document.querySelector('.capyui-moment')
        if (m && m.classList.contains('show')) {
          const c = m.querySelector('.capyui-momentkick').textContent + ' | ' + m.querySelector('.capyui-momenttext').textContent + ' | ' + m.querySelector('.capyui-momentnote').textContent
          if (c !== lastCard) { lastCard = c; cards.push(+t.toFixed(1) + ' ' + c) }
        }
        const a = g.marchAudit ? g.marchAudit() : null
        if (a && a.on && marchAt < 0) marchAt = +t.toFixed(1)
        if (t > 16) res({ labels: labels, cards: cards, marchAt: marchAt, warnAt: warnAt, audit: a, ring: g.repRing ? g.repRing().length : -1, toasts: (document.querySelector('.capyui-toasts') || {}).textContent || '', noto: g.notoDebug() })
        else requestAnimationFrame(step)
      })()
    }))
    out[mode] = res
  }
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(async (o) => { await fetch('/shot?name=n1ladder.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
