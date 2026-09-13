async page => {
  const BIOME = 'sydney'
  const TAG = 'l7r-design-follow-' + BIOME
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
  // the chapter's rows, in author order
  const rows = await page.evaluate(async b => { const m = await import('/src/shared.js'); const ch = m.CHAPTERS.find(c => c.biome === b); return m.TASKS.filter(t => t.chapter === ch.n).map(t => t.id) }, BIOME)
  const out = { biome: BIOME, rows, legs: [], ticks: [] }
  const tap = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k) }
  const held = new Set()
  const setKeys = async want => {
    for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k) }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k) }
  }
  const T_END = 180
  const t0 = Date.now()
  const now = () => (Date.now() - t0) / 1000
  let cur = null, legStart = 0, stuckT = 0, lastD = 1e9
  while (now() < T_END) {
    const s = await page.evaluate(async rows => {
      const g = window.__capy
      const p = g.capy.position
      let target = null, id = null
      for (const r of rows) { if (g.taskDone(r)) continue; const h = g.hintTarget(r); if (h) { target = h; id = r; break } }
      const done = rows.filter(r => g.taskDone(r))
      return { t: +g.state.time.toFixed(1), x: p.x, y: p.y, z: p.z, camYaw: g.input.camYaw, id, target, done, err: g.state.lastError || null, chase: !!g.capy.carriedBy }
    }, rows)
    if (s.err) { out.err = s.err; break }
    for (const d of s.done) if (!out.ticks.find(t => t[1] === d)) out.ticks.push([+now().toFixed(1), d])
    if (!s.id) { out.legs.push(['no-target', +now().toFixed(1)]); break }
    if (s.id !== cur) { if (cur) out.legs.push([cur, +legStart.toFixed(1), +now().toFixed(1), 'switched']); cur = s.id; legStart = now(); stuckT = 0; lastD = 1e9 }
    const dx = s.target.x - s.x, dz = s.target.z - s.z
    const d = Math.hypot(dx, dz)
    const cy = Math.cos(s.camYaw), sy = Math.sin(s.camYaw)
    const ix = dx * cy - dz * sy, iz = dx * sy + dz * cy
    const want = new Set()
    if (d > 1.6) {
      if (iz < -0.3 * d) want.add('KeyW'); if (iz > 0.3 * d) want.add('KeyS')
      if (ix < -0.3 * d) want.add('KeyA'); if (ix > 0.3 * d) want.add('KeyD')
      if (d > 12) want.add('ShiftLeft')
    }
    await setKeys(want)
    // a player near the thing presses E, and hops if nothing happens
    if (d < 3.2) { await tap('KeyE', 140); await page.waitForTimeout(120) }
    if (lastD - d < 0.15) stuckT += 0.35; else stuckT = 0
    lastD = d
    if (stuckT > 2.0) { await tap('Space', 90); stuckT = 0.8 }
    // stuck for long on one row: a player gives up and tries the next row
    if (now() - legStart > 45) { out.legs.push([cur, +legStart.toFixed(1), +now().toFixed(1), 'gave-up', +d.toFixed(1)]); rows.splice(rows.indexOf(cur), 1); cur = null }
    await page.waitForTimeout(200)
    const n = Math.floor(now())
    if (n % 30 === 0 && !out['shot' + n]) { out['shot' + n] = 1; await page.screenshot({ path: 'qa/' + TAG + '-' + String(n).padStart(3, '0') + '.png' }) }
  }
  await setKeys(new Set())
  if (cur) out.legs.push([cur, +legStart.toFixed(1), +now().toFixed(1), 'end'])
  await page.screenshot({ path: 'qa/' + TAG + '-end.png' })
  out.events = await page.evaluate(() => window.__ev)
  out.done = await page.evaluate(async () => { const g = window.__capy; const m = await import('/src/shared.js'); return m.TASKS.filter(t => g.taskDone(t.id)).map(t => t.id) })
  out.noticed = await page.evaluate(() => { const g = window.__capy; try { return g.noticed() } catch (e) { return String(e) } })
  await page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
}
