async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const out = { errs, started: await page.evaluate(() => window.__capy.state.started), ch: {} }
  const k = page.keyboard
  for (const ch of ['cali', 'rio']) {
    await page.evaluate((c) => window.__capy.hud.cross(c), ch); await page.waitForTimeout(9000)
    const sample = (secs) => page.evaluate(async (secs) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
      const g = window.__capy
      const per = []
      let last = g.musAudit().bandHits, t0 = performance.now(), sec = 0, acc = 0
      while (performance.now() - t0 < secs * 1000) {
        const m = g.musAudit()
        acc += m.bandHits - last; last = m.bandHits
        const s = Math.floor((performance.now() - t0) / 1000)
        if (s !== sec) { per.push(acc); acc = 0; sec = s }
        await sleep(100)
      }
      const m = g.musAudit()
      return { per, throws: m.throws, chaseT: m.chaseT, beatLen: m.beatLen, busy: m.busy, err: g.state.lastError || null }
    }, secs)
    const row = {}
    row.still = await sample(12)
    const cp = sample(12)
    await page.evaluate(() => { window.__capy.events.emit('npc:chase', { authority: false }) })
    await k.down('ShiftLeft'); await k.down('KeyW'); await page.waitForTimeout(5000); await k.up('KeyW'); await k.up('ShiftLeft')
    row.chase = await cp
    await page.evaluate(() => { window.__capy.events.emit('npc:lost', {}) })
    out.ch[ch] = row
  }
  out.errsN = errs.length
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l7-e2-bandrate.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
