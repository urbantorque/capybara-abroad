async page => {
  // x4-boss: O Grandão. The herd seeded at five in the river, the boss comes
  // up behind the line; wheek whenever it is up and within 20 m; expect three
  // hits, 'beaten', the line and the toasts, and the crossing still tickable.
  await page.setViewportSize({ width: 1200, height: 700 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(4500)
  await page.keyboard.press('Digit1'); await page.waitForTimeout(3500)
  const hold = async (code, ms) => { await page.keyboard.down(code); await page.waitForTimeout(ms); await page.keyboard.up(code) }
  const live = () => page.evaluate(() => (document.querySelector('.capyui-marqlive') || {}).textContent || '')
  await page.evaluate(() => window.__capy.biome.switchTo('pantanal')); await page.waitForTimeout(2500)
  await page.evaluate(() => { const g = window.__capy; const b = g.capy.body; b.position.set(-34, -0.2, -70); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) })
  await page.waitForTimeout(400)
  await page.evaluate(() => window.__capy.pantanal.herdFollow(5))
  const out = { rows: [], toasts: [] }
  let shot = false
  for (let i = 0; i < 160; i++) {
    await page.waitForTimeout(250)
    const d = await page.evaluate(() => { const g = window.__capy; const h = g.pantanal.huntDebug(); const p = g.capy.body.position; h.dist = +Math.hypot(h.hx - p.x, h.hz - p.z).toFixed(1); h.pz = +p.z.toFixed(1); return h })
    d.line = await live()
    if (!out.rows.length || JSON.stringify([d.on, d.lives, d.under > 0, Math.round(d.dist / 5)]) !== JSON.stringify([out.rows[out.rows.length - 1].on, out.rows[out.rows.length - 1].lives, out.rows[out.rows.length - 1].under > 0, Math.round(out.rows[out.rows.length - 1].dist / 5)])) out.rows.push(d)
    if (d.on && !shot && d.dist < 14 && d.under <= 0) { shot = true; await page.screenshot({ path: 'qa/x4-boss.png' }) }
    if (d.on && d.under <= 0 && d.dist < 18) {
      await hold('KeyQ', 180); await page.waitForTimeout(600)
      out.toasts.push(await page.evaluate(() => Array.from(document.querySelectorAll('.capyui-toast')).map(e => e.textContent).join(' / ')))
    }
    if (d.beaten) break
    // keep the animal in the water, drifting slowly toward the far bank
    if (i % 8 === 0) await page.evaluate(() => { const b = window.__capy.capy.body; if (b.position.z > -74) b.position.z -= 0.5 })
  }
  out.final = await page.evaluate(() => window.__capy.pantanal.huntDebug())
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/x4-beaten.png' })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(async (o) => { await fetch('/shot?name=x4boss.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
