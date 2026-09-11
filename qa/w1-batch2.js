async page => {
  // w1-batch2: the jacaré on the line (Pantanal), the barrel geometry (Manly),
  // the avalanche (Marrakech), the orca queue (Antarctica), the Hanoi nose.
  await page.setViewportSize({ width: 1400, height: 800 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(4500)
  await page.keyboard.press('Digit1'); await page.waitForTimeout(5000)
  const out = {}
  const hold = async (code, ms) => { await page.keyboard.down(code); await page.waitForTimeout(ms); await page.keyboard.up(code) }
  const tp = (name, x, y, z) => page.evaluate(([name, x, y, z]) => {
    const g = window.__capy; if (g.biome.current !== name) g.biome.switchTo(name)
    const b = g.capy.body; b.position.set(x, y, z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
  }, [name, x, y, z])
  const live = () => page.evaluate(() => (document.querySelector('.capyui-marqlive') || {}).textContent)

  // ---- Pantanal: the hunter -------------------------------------------------
  await page.evaluate(() => window.__capy.biome.switchTo('pantanal')); await page.waitForTimeout(3000)
  const cross = await page.evaluate(() => { const g = window.__capy; const r = g.pantanal.riverDebug ? g.pantanal.riverDebug() : null; return r })
  out.panRiver = cross
  // the crossing zone: the river is z -80..-56; stand mid-river on the crossing's x
  const cx = (cross && cross.crossX !== undefined) ? cross.crossX : -34
  await tp('pantanal', cx, -0.2, -70)
  await page.waitForTimeout(400)
  await page.evaluate(() => window.__capy.pantanal.herdFollow(5))
  const pan = []
  for (let i = 0; i < 80; i++) {
    await page.waitForTimeout(250)
    const d = await page.evaluate(() => window.__capy.pantanal.huntDebug())
    d.toasts = await page.evaluate(() => Array.from(document.querySelectorAll('.capyui-toast')).map(e => e.textContent).join(' / '))
    d.live = await live()
    pan.push(d)
    if (d.on && !out.panShot && Math.hypot(d.hx + 34, d.hz + 70) < 14) { out.panShot = true; await page.screenshot({ path: 'qa/w1-pantanal-hunt.png' }); await hold('KeyQ', 160) }
    if (d.saved > 0 || d.took > 0) break
  }
  out.pan = pan.filter((r, i) => i % 4 === 0 || r.on || r.saved || r.took)

  // ---- Manly: the barrel geometry --------------------------------------------
  await page.evaluate(() => window.__capy.biome.switchTo('manly')); await page.waitForTimeout(3000)
  await tp('manly', 0, 0.3, -24)
  await page.evaluate(() => window.__capy.manly.barrelDebug(true))
  await page.waitForTimeout(1500)
  out.manBarrel = await page.evaluate(() => window.__capy.manly.barrelDebug())
  await page.screenshot({ path: 'qa/w1-manly-barrel.png' })
  await page.evaluate(() => window.__capy.manly.barrelDebug(false))

  // ---- Marrakech: the run, by shove ---------------------------------------------
  await page.evaluate(() => window.__capy.biome.switchTo('sahara')); await page.waitForTimeout(3000)
  await tp('sahara', 284, 60, 10)
  await page.waitForTimeout(800)
  const sah = []
  const key = await page.evaluate(() => { const cy = window.__capy.input.camYaw || 0; const rel = Math.atan2(-1, 0) - cy - Math.PI; const c = Math.cos(rel), s = Math.sin(rel); return c > 0.38 ? 'KeyW' : c < -0.38 ? 'KeyS' : s > 0 ? 'KeyA' : 'KeyD' })
  out.sahKey = key
  await page.keyboard.down(key)
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(400)
    sah.push({ live: await live(), p: await page.evaluate(() => { const p = window.__capy.capy.position; const v = window.__capy.capy.velocity; return [+p.x.toFixed(0), +p.y.toFixed(1), +Math.hypot(v.x, v.z).toFixed(1)] }) })
    if (i === 12) await page.screenshot({ path: 'qa/w1-sahara-run.png' })
  }
  await page.keyboard.up(key)
  out.sah = sah
  await tp('sahara', 268, 60, 10)
  await page.waitForTimeout(1500)
  await page.evaluate(() => { const g = window.__capy; g.capy.launch(-16, 1.5, 0) })
  await page.waitForTimeout(700)
  out.sahAval = { live: await live(), dust: await page.evaluate(() => window.__capy.sahara.dustDebug ? window.__capy.sahara.dustDebug() : null) }
  await page.screenshot({ path: 'qa/w1-sahara-aval.png' })

  out.lastError = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(async (o) => {
    await fetch('/shot?name=w1batch2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
