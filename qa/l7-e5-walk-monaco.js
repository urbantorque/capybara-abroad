async page => {
  const BIOME = 'monaco'
  const TAG = 'l7-e5-walk-' + BIOME
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/', { waitUntil: 'commit', timeout: 120000 }); await page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go'), null, { timeout: 120000 }); await page.waitForTimeout(3000)
  await page.evaluate(() => {
    window.__ev = []
    const t0 = performance.now()
    const stamp = () => Math.round((performance.now() - t0) / 100) / 10
    const w = document.querySelector('.capyui-toasts')
    if (w) new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.textContent) window.__ev.push([stamp(), 'toast', n.textContent.slice(0, 90)]) }).observe(w, { childList: true })
    const h = document.getElementById('hud') || document.body
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.className && /place|moment|done|keep|noto|inc|marq|card|mapn/.test(String(n.className))) window.__ev.push([stamp(), 'card:' + String(n.className).slice(0, 30), (n.textContent || '').replace(/\s+/g, ' ').slice(0, 100)]) }).observe(h, { childList: true, subtree: true })
    document.querySelector('.capyui-go').click()
  })
  await page.waitForTimeout(6000)
  if (BIOME !== 'sydney') { await page.evaluate(b => window.__capy.hud.cross(b), BIOME); await page.waitForTimeout(9000) }
  const tArrive = Date.now()
  const state = () => page.evaluate(async b => {
    const g = window.__capy
    const p = g.capy.position
    return { t: +g.state.time.toFixed(1), biome: g.biome.current, x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1),
      paper: ((document.querySelector('.capyui-todo') || {}).textContent || '').replace(/\s+/g, ' ').slice(0, 200),
      err: g.state.lastError || null }
  }, BIOME)
  const tap = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k) }
  const out = { biome: BIOME, samples: [], ticks: [], imp: [] }
  out.samples.push(await state())
  let seed = 11
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const dirs = ['KeyW', 'KeyW', 'KeyW', 'KeyA', 'KeyD', 'KeyS']
  const T_END = 180
  let t = 0, i = 0
  const seenDone = new Set()
  const impSeen = new Set()
  const noteTicks = async () => {
    const d = await page.evaluate(async () => { const g = window.__capy; const m = await import('/src/shared.js'); return { d: m.TASKS.filter(t => g.taskDone(t.id)).map(t => t.id), imp: g.state.impulseLast || null } })
    for (const id of d.d) if (!seenDone.has(id)) { seenDone.add(id); out.ticks.push([+((Date.now() - tArrive) / 1000).toFixed(1), id]) }
    if (d.imp && !impSeen.has(d.imp.t)) { impSeen.add(d.imp.t); out.imp.push(d.imp) }
  }
  await noteTicks()
  out.arrivalTicks = [...seenDone]
  while (t < T_END) {
    const run = rnd() < 0.5
    if (run) await page.keyboard.down('ShiftLeft')
    const k = dirs[Math.floor(rnd() * dirs.length)]
    const ms = 600 + Math.floor(rnd() * 1400)
    if (rnd() < 0.35) { await page.mouse.move(640, 380); await page.mouse.down(); await page.mouse.move(640 + (rnd() < 0.5 ? -180 : 180), 380, { steps: 8 }); await page.mouse.up() }
    await page.keyboard.down(k)
    await page.waitForTimeout(ms)
    if (rnd() < 0.3) await tap('Space', 90)
    await page.keyboard.up(k)
    if (run) await page.keyboard.up('ShiftLeft')
    if (rnd() < 0.5) { await tap('KeyE', 160); await page.waitForTimeout(300) }
    if (rnd() < 0.15) { await tap('KeyQ', 110); await page.waitForTimeout(600) }
    if (rnd() < 0.1) { await tap('KeyG', 700) }
    t = (Date.now() - tArrive) / 1000
    i++
    await noteTicks()
    if (i % 12 === 0) { out.samples.push(await state()) }
  }
  out.samples.push(await state())
  await page.screenshot({ path: 'qa/' + TAG + '-end.png' })
  out.events = await page.evaluate(() => window.__ev)
  out.done = [...seenDone]
  const ev = out.events
  out.shove = ev.filter(e => e[1] === 'toast' && /^that was /.test(e[2])).map(e => [e[0], e[2]])
  out.shoveUnnamed = out.shove.filter(e => /something back there/.test(e[1])).length
  out.impUnsrc = out.imp.filter(x => !x.src).length
  out.voids = ev.filter(e => /not part of the world|put you back|turned you round/.test(e[2])).length
  out.tickN = out.ticks.filter(x => x[1] !== 'to-' + BIOME && !/^to-/.test(x[1])).length
  out.firstNonFree = (out.ticks.find(x => !/^to-/.test(x[1])) || [null])[0]
  await page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
}
