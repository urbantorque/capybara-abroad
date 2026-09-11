async page => {
  // THE ERRAND (L3-8): Venice's waiter carries a cup to the far table; wait for
  // him to set off, run into him, and the cup should be on the floor.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.keyboard.press('Digit0')
  await page.waitForTimeout(7000)
  const w = () => page.evaluate(() => { const g = window.__capy; const r = g.locals.find(x => x.biome === 'venice' && x.errand); if (!r) return null; return { phase: r.errPhase, n: r.errN, t: +r.errT.toFixed(1), x: +r.x.toFixed(1), z: +r.z.toFixed(1), p: r.errP ? { held: !!r.errP.held, spilled: !!r.errP.spilled, y: +r.errP.body.position.y.toFixed(2) } : null } })
  const out = { rows: [], errs }
  let t0 = Date.now()
  let started = null
  while (Date.now() - t0 < 30000) {
    const a = await w(); out.rows.push(a)
    if (a && a.phase === 'out') { started = a; break }
    await page.waitForTimeout(1000)
  }
  if (started) {
    await page.screenshot({ path: 'qa/l3-errand-out.png' })
    // teleport in front of him and run through him
    await page.evaluate(() => { const g = window.__capy; const r = g.locals.find(x => x.biome === 'venice' && x.errand); const b = g.capy.body
      const yaw = r.yaw; const x = r.x + Math.sin(yaw) * 4.5, z = r.z + Math.cos(yaw) * 4.5
      b.position.set(x, r.y + 0.8, z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      // face him: capybara.js reads the camera yaw; set the body toward him by velocity
      b.velocity.set(-Math.sin(yaw) * 7, 0, -Math.cos(yaw) * 7) })
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyS')
    await page.waitForTimeout(1500)
    await page.keyboard.up('KeyS'); await page.keyboard.up('ShiftLeft')
    await page.waitForTimeout(1500)
    out.after = await w()
    out.props = await page.evaluate(() => window.__capy.props.filter(p => p.type === 'coffee').map(p => ({ spilled: !!p.spilled, owner: !!p.owner, y: +p.body.position.y.toFixed(2) })))
    out.toasts = await page.evaluate(() => Array.from(document.querySelectorAll('.capyui-toast')).map(e => e.textContent))
    await page.screenshot({ path: 'qa/l3-errand-after.png' })
  }
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate((o) => fetch('/shot?name=l3-errand.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), out)
}
