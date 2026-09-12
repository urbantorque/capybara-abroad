async page => {
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(5000)
  await page.evaluate(() => {
    window.__toasts = []
    const w = document.querySelector('.capyui-toasts')
    if (w) new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.textContent) window.__toasts.push([Math.round(performance.now() / 1000), n.textContent]) }).observe(w, { childList: true })
    window.__cards = []
    const h = document.getElementById('hud') || document.body
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.className && /place|moment|done|keep|noto|inc/.test(String(n.className))) window.__cards.push([Math.round(performance.now() / 1000), String(n.className), (n.textContent || '').slice(0, 120)]) }).observe(h, { childList: true, subtree: true })
  })
  await page.keyboard.press('Digit1'); await page.waitForTimeout(8000)
  await page.screenshot({ path: 'qa/l4r-design-syd-00.png' })
  const state = () => page.evaluate(() => {
    const g = window.__capy
    const p = g.capy.position
    return { t: +g.state.time.toFixed(1), x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1), score: g.state.score,
      paper: (document.querySelector('.capyui-todo') || {}).textContent, chain: (document.querySelector('.capyui-chain') || {}).textContent }
  })
  const out = { s0: await state() }
  const tap = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k) }
  // minute one: wheek, walk toward the nearest person, hop, grab
  await tap('KeyQ', 120); await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/l4r-design-syd-01-wheek.png' })
  await tap('KeyW', 1800); await tap('Space', 100); await page.waitForTimeout(700)
  await tap('KeyE', 150); await page.waitForTimeout(800)
  await page.screenshot({ path: 'qa/l4r-design-syd-02.png' })
  // run about with shift, turn, hop, grab repeatedly for 60 s
  const seq = ['KeyW', 'KeyA', 'KeyW', 'KeyD', 'KeyW', 'KeyW', 'KeyA', 'KeyW']
  await page.keyboard.down('ShiftLeft')
  for (let i = 0; i < 10; i++) {
    await tap(seq[i % seq.length], 900)
    if (i % 3 === 0) await tap('Space', 100)
    if (i % 2 === 1) { await tap('KeyE', 150); await page.waitForTimeout(400) }
    if (i === 4) { await page.keyboard.up('ShiftLeft'); await tap('KeyG', 900); await page.keyboard.down('ShiftLeft') }
    if (i === 5) await page.screenshot({ path: 'qa/l4r-design-syd-03.png' })
    if (i === 8) await page.screenshot({ path: 'qa/l4r-design-syd-04.png' })
  }
  await page.keyboard.up('ShiftLeft')
  await tap('KeyQ', 120); await page.waitForTimeout(2500)
  await page.screenshot({ path: 'qa/l4r-design-syd-05.png' })
  await tap('Tab', 100); await page.waitForTimeout(1200)
  await page.screenshot({ path: 'qa/l4r-design-syd-06-paper.png' })
  await tap('Tab', 100); await page.waitForTimeout(500)
  await tap('KeyK', 100); await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/l4r-design-syd-07-photo.png' })
  await tap('KeyK', 100)
  out.s1 = await state()
  out.toasts = await page.evaluate(() => window.__toasts)
  out.cards = await page.evaluate(() => window.__cards)
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  out.tasks = await page.evaluate(() => { const g = window.__capy; return ['wheek', 'steal-hat', 'coffee-spill', 'picnic-thief', 'bin-chicken', 'photo-op', 'chased'].map(id => id + ':' + g.taskDone(id)) })
  await page.evaluate(o => fetch('/shot?name=l4r-design-syd.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
