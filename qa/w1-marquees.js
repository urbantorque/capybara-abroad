async page => {
  // w1-marquees: the live channel and the new beats, chapter by chapter, by
  // teleport. Fresh save, started, then each chapter is entered and its
  // marquee is driven far enough to read the signpost's live line.
  await page.setViewportSize({ width: 1400, height: 800 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(4500)
  await page.keyboard.press('Digit1'); await page.waitForTimeout(5000)
  const out = {}
  const card = () => page.evaluate(() => {
    const q = s => { const e = document.querySelector(s); return e ? e.textContent : null }
    const g = window.__capy
    return { biome: g.biome.current, cls: (document.querySelector('.capyui-marq') || {}).className,
             head: q('.capyui-marqhead'), name: q('.capyui-marqname'), live: q('.capyui-marqlive'),
             bar: (document.querySelector('.capyui-marqbar i') || { style: {} }).style.width,
             liveAt: g.wowLiveAt ? g.wowLiveAt() : null, err: g.state.lastError || null }
  })
  const tp = (name, x, y, z) => page.evaluate(([name, x, y, z]) => {
    const g = window.__capy; if (g.biome.current !== name) g.biome.switchTo(name)
    const b = g.capy.body; b.position.set(x, y, z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
  }, [name, x, y, z])
  const hold = async (code, ms) => { await page.keyboard.down(code); await page.waitForTimeout(ms); await page.keyboard.up(code) }

  // ---- Kyoto: the chute -----------------------------------------------------
  await page.evaluate(() => window.__capy.biome.switchTo('kyoto')); await page.waitForTimeout(3000)
  const ch = await page.evaluate(() => { const k = window.__capy.kyoto; const c = k.chuteAt(1); const u = k.aheadOnRiver(c.x, c.z, -22); return { x: c.x, z: c.z, s: c.s, ux: u.x, uz: u.z } })
  out.kyoChute = ch
  await tp('kyoto', ch.ux, -0.5, ch.uz)
  const kyo = []
  for (let i = 0; i < 80; i++) {
    await page.waitForTimeout(100)
    kyo.push(await page.evaluate(() => { const g = window.__capy; const p = g.capy.position
      return { y: +p.y.toFixed(2), s: g.kyoto.runTime(), fired: g.kyoto.chuteAt(1).fired,
               live: (document.querySelector('.capyui-marqlive') || {}).textContent } }))
    if (kyo[kyo.length - 1].fired && i > 4) { await page.screenshot({ path: 'qa/w1-kyoto-chute.png' }) }
  }
  out.kyoRun = kyo.filter((r, i) => i % 8 === 0 || (r.fired && r.y > -0.6))
  out.kyoMaxY = Math.max(...kyo.map(r => r.y))
  out.kyoFired = kyo.some(r => r.fired)

  // ---- Quay: the Heads ------------------------------------------------------
  await page.evaluate(() => window.__capy.biome.switchTo('quay')); await page.waitForTimeout(3000)
  await page.evaluate(() => { const g = window.__capy; g.quay.boatDebugTo(80, -360) })
  await page.waitForTimeout(3000)
  out.quayHeads = await page.evaluate(() => ({ k: window.__capy.quay.headsK(), y: window.__capy.quay.boat.position.y }))
  await page.evaluate(() => { const g = window.__capy; g.quay.boatDebugTo(20, -100) })
  await page.waitForTimeout(3000)
  out.quayHarbour = await page.evaluate(() => ({ k: window.__capy.quay.headsK() }))

  // ---- Cali: fireworks + live -------------------------------------------------
  await page.evaluate(() => window.__capy.biome.switchTo('cali')); await page.waitForTimeout(2500)
  out.caliCard = await card()

  // ---- Iceland: the call ------------------------------------------------------
  await page.evaluate(() => window.__capy.biome.switchTo('iceland')); await page.waitForTimeout(2500)
  const sp = await page.evaluate(() => window.__capy.iceland.spring)
  await tp('iceland', sp.x, 0.2, sp.z)
  await page.waitForTimeout(9000)                 // the soak (7 s) + a little
  out.iceSoak = await card()
  await page.waitForTimeout(11000)                // the sky comes up
  out.iceUp = await card()
  await page.screenshot({ path: 'qa/w1-iceland-up.png' })
  await hold('KeyQ', 160)
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'qa/w1-iceland-call.png' })
  out.iceCall = await page.evaluate(() => ({ done: window.__capy.taskDone('aurora'), aur: window.__capy.iceland.aurora() }))

  // ---- Hanoi: the alley countdown ----------------------------------------------
  await page.evaluate(() => window.__capy.biome.switchTo('hanoi')); await page.waitForTimeout(2500)
  await tp('hanoi', -82, 0.6, 48.5)
  await page.waitForTimeout(1500)
  out.hanoiCard = await card()

  // ---- Cappadocia: the live line needs aboard; just read the card -------------
  await page.evaluate(() => window.__capy.biome.switchTo('goreme')); await page.waitForTimeout(2500)
  out.goremeCard = await card()

  out.lastError = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(async (o) => {
    await fetch('/shot?name=w1marq.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
