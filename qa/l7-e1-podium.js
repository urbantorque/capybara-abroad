async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => {
    try { localStorage.clear() } catch (e) {}
    // catch the first non-finite ramp with its stack
    window.__rampBad = []
    const P = window.AudioParam && window.AudioParam.prototype
    if (P) {
      for (const k of ['exponentialRampToValueAtTime', 'linearRampToValueAtTime', 'setValueAtTime', 'setTargetAtTime']) {
        const o = P[k]
        P[k] = function (v, t, tau) {
          if (!(v === v) || !(t === t) || v === Infinity || v === -Infinity || t === Infinity || (tau !== undefined && !(tau === tau))) {
            if (window.__rampBad.length < 6) window.__rampBad.push(k + ' v=' + v + ' t=' + t + ' tau=' + tau + '\n' + (new Error().stack || '').split('\n').slice(2, 9).join('\n'))
          }
          return o.apply(this, arguments)
        }
      }
    }
  })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(9000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const out = { errs, started: await page.evaluate(() => window.__capy.state.started) }
  out.put = await page.evaluate(async () => {
    const g = window.__capy
    const m = await import('/src/shared.js')
    const ch = m.CHAPTERS.find(c => c.biome === 'sydney')
    const wowRow = m.TASKS.find(t => t.chapter === ch.n && t.wow)
    let h = null
    try { h = g.hintTarget(wowRow.id) } catch (e) {}
    if (!h) { const mq = ch.marquee; h = { x: mq.x, y: (mq.up || 0), z: mq.z } }
    const p = g.capy.position
    const dx = h.x - p.x, dz = h.z - p.z, d = Math.hypot(dx, dz) || 1
    const tx = h.x - dx / d * 3, tz = h.z - dz / d * 3
    let ty = h.y
    try { if (typeof g.groundY === 'function') ty = g.groundY(tx, tz) } catch (e) {}
    const body = g.capy.body
    if (body) { body.position.set(tx, ty + 0.6, tz); body.velocity.set(0, 0, 0) } else { g.capy.position.set(tx, ty + 0.6, tz) }
    return { id: wowRow.id, at: [+tx.toFixed(1), +(ty + 0.6).toFixed(1), +tz.toFixed(1)], h }
  })
  await page.waitForTimeout(4000)
  await page.keyboard.press('KeyQ'); await page.waitForTimeout(3000)
  await page.keyboard.press('KeyE'); await page.waitForTimeout(3000)
  out.after = await page.evaluate(() => { const g = window.__capy; const p = g.capy.position; return { pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], err: g.state.lastError || null, bad: window.__rampBad, mus: (() => { const m = g.musAudit(); return { pal: m.pal, busy: m.busy } })() } })
  out.errsN = errs.length
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l7-e1-podium.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
