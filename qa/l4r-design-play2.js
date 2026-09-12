async page => {
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(5000)
  const arm = () => page.evaluate(() => {
    window.__toasts = []
    const w = document.querySelector('.capyui-toasts')
    if (w) new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.textContent) window.__toasts.push([Math.round(performance.now() / 1000), n.textContent]) }).observe(w, { childList: true })
  })
  await arm()
  const out = {}
  const tap = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k) }
  const state = () => page.evaluate(() => {
    const g = window.__capy; const p = g.capy.position
    return { t: +g.state.time.toFixed(1), x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1), score: g.state.score, biome: g.biome.current,
      chain: (document.querySelector('.capyui-chain') || {}).textContent || '', bubbles: Array.from(document.querySelectorAll('.capyui-bubble, .npc-bubble, [class*=bubble]')).map(e => e.textContent).slice(0, 6) }
  })
  // ---- HANOI (Slash) ----
  await page.keyboard.press('Slash'); await page.waitForTimeout(10000)
  await page.screenshot({ path: 'qa/l4r-design-han-00.png' })
  out.han0 = await state()
  const t0 = Date.now()
  // walk into the traffic, do not stop: W held 12 s, then look about
  await page.keyboard.down('KeyW'); await page.waitForTimeout(4000)
  await page.screenshot({ path: 'qa/l4r-design-han-01.png' })
  await page.waitForTimeout(6000); await page.keyboard.up('KeyW')
  await page.screenshot({ path: 'qa/l4r-design-han-02.png' })
  await tap('KeyQ', 120); await page.waitForTimeout(1500)
  await tap('KeyA', 1500); await tap('KeyE', 150); await page.waitForTimeout(600)
  await page.keyboard.down('ShiftLeft'); await tap('KeyW', 2500); await tap('Space', 100); await page.waitForTimeout(600)
  await tap('KeyD', 1200); await tap('KeyW', 2000); await page.keyboard.up('ShiftLeft')
  await tap('KeyE', 150); await page.waitForTimeout(800)
  await page.screenshot({ path: 'qa/l4r-design-han-03.png' })
  await tap('KeyW', 3000); await tap('KeyQ', 120); await page.waitForTimeout(2500)
  await page.screenshot({ path: 'qa/l4r-design-han-04.png' })
  out.han1 = await state()
  out.hanSecs = Math.round((Date.now() - t0) / 1000)
  out.hanToasts = await page.evaluate(() => window.__toasts)
  out.hanTasks = await page.evaluate(() => { const g = window.__capy; return ['to-hanoi', 'cross-the-road', 'the-stools', 'pho-face'].map(id => id + ':' + g.taskDone(id)) })
  // ---- KYOTO via the title? use switchTo for speed ----
  await page.evaluate(() => window.__capy.biome.switchTo('kyoto')); await page.waitForTimeout(6000)
  await arm()
  await page.screenshot({ path: 'qa/l4r-design-kyo-00.png' })
  out.kyo0 = await state()
  const t1 = Date.now()
  // walk toward the lantern (the arrow says 14 m) by reading the aim
  for (let i = 0; i < 6; i++) {
    const aim = await page.evaluate(() => { const g = window.__capy; const a = g.hintTarget('lantern-topple'); return a ? { dx: a.x - g.capy.position.x, dz: a.z - g.capy.position.z, yaw: g.input.camYaw } : null })
    if (!aim) break
    // camera-relative: worldX = ix*cy + iz*sy, worldZ = -ix*sy + iz*cy ; W is iz -= 1
    const cy = Math.cos(aim.yaw), sy = Math.sin(aim.yaw)
    const ix = cy * aim.dx - sy * aim.dz, iz = sy * aim.dx + cy * aim.dz
    const keys = []
    if (iz < -0.3) keys.push('KeyW'); if (iz > 0.3) keys.push('KeyS')
    if (ix > 0.3) keys.push('KeyD'); if (ix < -0.3) keys.push('KeyA')
    await page.keyboard.down('ShiftLeft')
    for (const k of keys) await page.keyboard.down(k)
    await page.waitForTimeout(1200)
    for (const k of keys) await page.keyboard.up(k)
    await page.keyboard.up('ShiftLeft')
  }
  await page.screenshot({ path: 'qa/l4r-design-kyo-01.png' })
  await tap('KeyQ', 120); await page.waitForTimeout(2000)
  await page.screenshot({ path: 'qa/l4r-design-kyo-02.png' })
  out.kyo1 = await state()
  out.kyoSecs = Math.round((Date.now() - t1) / 1000)
  out.kyoToasts = await page.evaluate(() => window.__toasts)
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=l4r-design-play2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
