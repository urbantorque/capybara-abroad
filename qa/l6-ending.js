async page => {
  const TAG = 'l6-ending'
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(4000)
  const allIds = await page.evaluate(async () => { const m = await import('/src/shared.js'); return m.TASKS.map(t => t.id) })
  await page.evaluate((ids) => {
    localStorage.clear()
    const seen = []; for (let k = 1; k <= 19; k++) seen.push(k)
    localStorage.setItem('capy3.journey.v1', JSON.stringify({ v: 1, tasks: ids, seen, recs: {}, told: 1, rtold: 1, ms: 9000000, chapms: {}, finds: [], foundAt: {}, biome: 'sydney', fin: 0 }))
  }, allIds)
  await page.reload(); await page.waitForTimeout(5500)
  await page.screenshot({ path: 'qa/' + TAG + '-00-title.png' })
  await page.evaluate(() => {
    window.__ev = []
    const t0 = performance.now()
    const stamp = () => Math.round((performance.now() - t0) / 100) / 10
    const w = document.querySelector('.capyui-toasts')
    if (w) new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.textContent) window.__ev.push([stamp(), 'toast', n.textContent.slice(0, 90)]) }).observe(w, { childList: true })
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) { if (n.nodeType !== 1) continue; const c = String(n.className || ''); if (/bubble/.test(c)) window.__ev.push([stamp(), 'bubble', (n.textContent || '').slice(0, 80)]); else if (/place|moment|done|keep|noto|inc|marq|card|led/.test(c)) window.__ev.push([stamp(), 'card:' + c.slice(0, 30), (n.textContent || '').replace(/\s+/g, ' ').slice(0, 120)]) } }).observe(document.body, { childList: true, subtree: true })
  })
  await page.keyboard.press('Enter'); await page.waitForTimeout(4000)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started), samples: [] }
  await page.screenshot({ path: 'qa/' + TAG + '-01-start.png' })
  const held = new Set()
  const setKeys = async want => {
    for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k) }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k) }
  }
  const t0 = Date.now(); const now = () => (Date.now() - t0) / 1000
  out.seeded = await page.evaluate(() => { const g = window.__capy; return { done: (document.querySelector('.capyui-todo') || {}).textContent, gate: g.gateInfo ? g.gateInfo(19) : null } })
  // walk to the middle of the horseshoe with real keys
  let lastD = 1e9, stuck = 0, detour = 0
  while (now() < 25) {
    const s = await page.evaluate(() => { const g = window.__capy; const p = g.capy.position; return { x: p.x, z: p.z, camYaw: g.input.camYaw } })
    let dx = 30 - s.x, dz = 26 - s.z
    const d = Math.hypot(dx, dz)
    if (d < 0.6) break
    if (lastD - d < 0.05) stuck += 0.12; else stuck = 0
    lastD = d
    if (stuck > 1.5 && detour <= 0) { await page.keyboard.press('Space'); detour = 1.6; stuck = 0 }
    if (detour > 0) { detour -= 0.12; const k = dx; dx = -dz; dz = k }
    const cy = Math.cos(s.camYaw), sy = Math.sin(s.camYaw)
    const ix = dx * cy - dz * sy, iz = dx * sy + dz * cy
    const want = new Set()
    if (iz < -0.3 * d) want.add('KeyW'); if (iz > 0.3 * d) want.add('KeyS')
    if (ix < -0.3 * d) want.add('KeyA'); if (ix > 0.3 * d) want.add('KeyD')
    await setKeys(want); await page.waitForTimeout(120)
  }
  await setKeys(new Set())
  out.walkT = +now().toFixed(1)
  out.tele = await page.evaluate(() => { const g = window.__capy; const p = g.capy.position; const d = Math.hypot(30 - p.x, 26 - p.z); if (d > 1.2 && g.capy.body) { g.capy.body.position.set(30, p.y + 0.3, 26); g.capy.body.velocity.set(0, 0, 0); return d } return 0 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/' + TAG + '-02-lawn.png' })
  // now sit still and sample
  for (let i = 0; i < 70; i++) {
    const s = await page.evaluate(() => { const g = window.__capy; const p = g.capy.position; const led = document.querySelector('.capyui-led'); return { t: +g.state.time.toFixed(1), x: +p.x.toFixed(1), z: +p.z.toFixed(1), loaf: +(g.capy.loaf || 0).toFixed(2), dist: +g.camInfo.dist.toFixed(1), ended: !!g.state.ended, coda: g.hud.codaAudit ? g.hud.codaAudit() : null, cap: (document.querySelector('.capyui-coda') || {}).textContent || '', bare: document.getElementById('hud').classList.contains('bare'), pitch: g.camInfo.pitch, yaw: +g.input.camYaw.toFixed(2), led: led ? led.className : null, err: g.state.lastError || null } })
    out.samples.push(s)
    if (i === 6) await page.screenshot({ path: 'qa/' + TAG + '-03-sit.png' })
    if (i === 12) await page.screenshot({ path: 'qa/' + TAG + '-04-coda.png' }); if (i === 14) await page.screenshot({ path: 'qa/' + TAG + '-04b-coda.png' })
    if (i === 30) await page.screenshot({ path: 'qa/' + TAG + '-05.png' })
    if (i === 50) await page.screenshot({ path: 'qa/' + TAG + '-06.png' })
    await page.waitForTimeout(500)
  }
  await page.screenshot({ path: 'qa/' + TAG + '-07-end.png' })
  out.events = await page.evaluate(() => window.__ev)
  await page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
}
