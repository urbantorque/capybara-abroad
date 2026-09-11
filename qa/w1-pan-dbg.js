async page => {
  const out = { rows: [] }
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(4500)
  await page.keyboard.press('Digit1'); await page.waitForTimeout(5000)
  const hold = async (code, ms) => { await page.keyboard.down(code); await page.waitForTimeout(ms); await page.keyboard.up(code) }
  await page.evaluate(() => { const g = window.__capy; g.biome.switchTo('pantanal') }); await page.waitForTimeout(2500)
  await page.evaluate(() => { const g = window.__capy; const b = g.capy.body; b.position.set(-34, -0.2, -70); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) })
  await page.waitForTimeout(400)
  await page.evaluate(() => window.__capy.pantanal.herdFollow(5))
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(250)
    const d = await page.evaluate(() => { const g = window.__capy; const h = g.pantanal.huntDebug(); const p = g.capy.body.position; h.dist = Math.hypot(h.hx - p.x, h.hz - p.z); h.px = p.x; h.pz = p.z; return h })
    out.rows.push(d)
    if (d.on && d.dist < 15) {
      await hold('KeyQ', 200); await page.waitForTimeout(400)
      const d2 = await page.evaluate(() => window.__capy.pantanal.huntDebug())
      d2.after = true; out.rows.push(d2)
      out.toasts = await page.evaluate(() => Array.from(document.querySelectorAll('.capyui-toast')).map(e => e.textContent))
      break
    }
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=w1pandbg.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
