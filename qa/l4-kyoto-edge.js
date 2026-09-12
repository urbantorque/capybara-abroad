async page => {
  // L4 — the Kyoto rescue loop seen in qa/l4-first-minute.js (four "put you
  // back" in five seconds at 44–49 s of a naive drive). Fresh file, Kyoto
  // from the picker, the same drive as the first-minute probe for 60 s,
  // sampling the animal's position, the worked-out bounds, the chapter's own
  // bounds() if any, grounded, and every rescue toast with its time and the
  // position it put the animal at.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit4')
  await page.waitForTimeout(9000)
  await page.evaluate(() => {
    const g = window.__capy
    const L = window.__l4ke = { t0: g.state.time, samples: [], rescues: [] }
    const api = g.kyoto || null
    L.bounds = g.biome.boundsOf ? g.biome.boundsOf('kyoto') : null
    L.own = api && typeof api.bounds === 'function' ? api.bounds() : null
    const mo = new MutationObserver(ms => {
      for (const m of ms) for (const n of m.addedNodes) {
        if (n.nodeType === 1 && n.classList && n.classList.contains('capyui-toast') && /put you back/.test(n.textContent)) {
          const p = g.capy.position
          L.rescues.push({ t: +(g.state.time - L.t0).toFixed(1), x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1) })
        }
      }
    })
    mo.observe(document.body, { childList: true, subtree: true })
    L.iv = setInterval(() => {
      const p = g.capy.position
      L.samples.push({ t: +(g.state.time - L.t0).toFixed(1), x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1), gr: !!g.capy.grounded })
    }, 1000)
  })
  const DIRS = ['KeyA', 'KeyD']
  for (let leg = 0; leg < 20; leg++) {
    const turn = DIRS[leg % 2], turnMs = 250 + (leg * 137) % 900
    const hop = leg % 2 === 1, grab = leg % 3 === 2, run = leg % 5 === 4
    await page.keyboard.down('KeyW')
    if (run) await page.keyboard.down('ShiftLeft')
    await page.keyboard.down(turn)
    await page.waitForTimeout(turnMs)
    await page.keyboard.up(turn)
    await page.waitForTimeout(900)
    if (hop) { await page.keyboard.press('Space'); await page.waitForTimeout(400) }
    if (grab) { await page.keyboard.press('KeyE'); await page.waitForTimeout(300) }
    await page.waitForTimeout(Math.max(200, 3000 - turnMs - 900 - (hop ? 400 : 0) - (grab ? 300 : 0)))
    if (run) await page.keyboard.up('ShiftLeft')
    await page.keyboard.up('KeyW')
  }
  const out = await page.evaluate(() => { const L = window.__l4ke; clearInterval(L.iv); const g = window.__capy
    return { biome: g.biome.current, bounds: L.bounds, own: L.own, samples: L.samples, rescues: L.rescues, err: g.state.lastError || null } })
  await page.evaluate((o) => fetch('/shot?name=l4-kyoto-edge.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
