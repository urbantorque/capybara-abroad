async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const out = { errs, started: await page.evaluate(() => window.__capy.state.started) }
  out.voices = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const g = window.__capy
    const names = ['bell', 'moped', 'penguin', 'heron', 'calve', 'crowd', 'kettle', 'swell']
    const res = {}
    for (const n of names) { try { g.sfx(n, { volume: 0.5, pitch: 1 }); res[n] = 'ok' } catch (e) { res[n] = String(e) } await sleep(400) }
    await sleep(1500)
    let mix = null; try { mix = g.hud.mixAudit() } catch (e) {}
    return { res, threw: mix && mix.synthThrew, why: mix && mix.synthWhy, err: g.state.lastError }
  })
  out.chase = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const g = window.__capy
    const m0 = g.musAudit()
    g.events.emit('npc:chase', { authority: false })
    await sleep(4000)
    const m1 = g.musAudit()
    g.events.emit('npc:lost', {})
    g.events.emit('npc:caught', {})
    await sleep(800)
    const m2 = g.musAudit()
    return { inst: m1.chaseInst, hits: m1.chaseHits - m0.chaseHits, denied: m2.cueDenied, err: g.state.lastError, amb: g.hud.ambAudit() }
  })
  out.errsN = errs.length
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l7-e2-smoke.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
