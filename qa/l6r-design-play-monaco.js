async page => {
  const BIOME = 'monaco'
  const TAG = 'l6r-design-play-' + BIOME
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(6000)
  await page.evaluate(() => {
    window.__ev = []
    const t0 = performance.now()
    const stamp = () => Math.round((performance.now() - t0) / 100) / 10
    const w = document.querySelector('.capyui-toasts')
    if (w) new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.textContent) window.__ev.push([stamp(), 'toast', n.textContent.slice(0, 90)]) }).observe(w, { childList: true })
    const h = document.getElementById('hud') || document.body
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.className && /place|moment|done|keep|noto|inc|marq|card/.test(String(n.className))) window.__ev.push([stamp(), 'card:' + String(n.className).slice(0, 30), (n.textContent || '').replace(/\s+/g, ' ').slice(0, 100)]) }).observe(h, { childList: true, subtree: true })
    document.querySelector('.capyui-go').click()
  })
  await page.waitForTimeout(6000)
  if (BIOME !== 'sydney') { await page.evaluate(b => window.__capy.hud.cross(b), BIOME); await page.waitForTimeout(9000) }
  const state = () => page.evaluate(() => {
    const g = window.__capy
    const p = g.capy.position
    return { t: +g.state.time.toFixed(1), started: g.state.started, biome: g.biome.current, x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1),
      paper: ((document.querySelector('.capyui-todo') || {}).textContent || '').replace(/\s+/g, ' ').slice(0, 300),
      err: g.state.lastError || null }
  })
  const tap = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k) }
  const out = { biome: BIOME, samples: [] }
  out.samples.push(await state())
  await page.screenshot({ path: 'qa/' + TAG + '-000.png' })
  // A naive new player: look at what is in front, walk toward it, press Q once,
  // press E when something is near, hop, run. Two and a half minutes, no hud.cross,
  // no teleports. The pattern is a random walk biased forward with periodic E/Space/Q.
  let seed = 7
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const dirs = ['KeyW', 'KeyW', 'KeyW', 'KeyA', 'KeyD', 'KeyS']
  const T_END = 150
  let t = 0, i = 0
  while (t < T_END) {
    const run = rnd() < 0.5
    if (run) await page.keyboard.down('ShiftLeft')
    const k = dirs[Math.floor(rnd() * dirs.length)]
    const ms = 600 + Math.floor(rnd() * 1400)
    // turn the camera a little sometimes, the way a mouse hand does
    if (rnd() < 0.35) { await page.mouse.move(640, 380); await page.mouse.down(); await page.mouse.move(640 + (rnd() < 0.5 ? -180 : 180), 380, { steps: 8 }); await page.mouse.up() }
    await page.keyboard.down(k)
    await page.waitForTimeout(ms)
    if (rnd() < 0.3) await tap('Space', 90)
    await page.keyboard.up(k)
    if (run) await page.keyboard.up('ShiftLeft')
    if (rnd() < 0.5) { await tap('KeyE', 160); await page.waitForTimeout(300) }
    if (rnd() < 0.15) { await tap('KeyQ', 110); await page.waitForTimeout(600) }
    t += (ms + 700) / 1000
    i++
    if (i % 8 === 0) { out.samples.push(await state()); await page.screenshot({ path: 'qa/' + TAG + '-' + String(Math.round(t)).padStart(3, '0') + '.png' }) }
  }
  out.samples.push(await state())
  await page.screenshot({ path: 'qa/' + TAG + '-end.png' })
  out.events = await page.evaluate(() => window.__ev)
  out.done = await page.evaluate(async () => { const g = window.__capy; const m = await import('/src/shared.js'); return m.TASKS.filter(t => g.taskDone(t.id)).map(t => t.id) })
  out.noticed = await page.evaluate(() => { const g = window.__capy; try { return g.noticed() } catch (e) { return String(e) } })
  await page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
}
