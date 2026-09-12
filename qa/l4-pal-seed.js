async page => {
  // L4 E5 — the seeded half of qa/l4-lines-soak.js on its own, with NO init
  // script in the context (trap 10/19: an armed localStorage.clear() wipes a
  // seeded save on the reload that is meant to read it). A journey with the
  // Sydney and Pasto regulars at tier 3, Enter to carry on, the animal put
  // down two metres from the waiter; then hud.cross('pasto') and the same
  // beside the abuela. Reports npc.js's palAudit before/after and what was
  // heard. qa/l4-pal-seed.json
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(3000)
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('capy3.journey.v1', JSON.stringify({
      v: 1, tasks: ['wheek'], seen: [1], recs: {}, told: 1, ms: 60000,
      chapms: {}, finds: [], foundAt: {}, biome: 'sydney', fin: 0,
      pal: { 1: 3, 2: 3 },
    }))
  })
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(3000)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started), save: await page.evaluate(() => localStorage.getItem('capy3.journey.v1')) }
  const watch = () => page.evaluate(() => {
    const g = window.__capy
    const L = window.__l4ps = { t0: g.state.time, heard: [] }
    const mo = new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) {
      if (n.nodeType === 1 && n.classList && n.classList.contains('capynpc-bubble')) L.heard.push(+(g.state.time - L.t0).toFixed(1) + ' ' + n.textContent.slice(0, 60)) } })
    mo.observe(document.body, { childList: true, subtree: true })
  })
  const seed = async (biome) => {
    await watch()
    const before = await page.evaluate(() => window.__capy.palAudit())
    await page.evaluate(() => {
      const g = window.__capy, a = g.palAudit()
      const f = (a.found || []).find(r => r.b === g.biome.current)
      if (!f) return
      const b = g.capy.body
      window.__l4ps.pin = setInterval(() => { b.position.set(f.x + 2, (f.y || 0) + 0.8, f.z); b.velocity.set(0, 0, 0) }, 100)
      window.__l4ps.trace = []
      window.__l4ps.tr = setInterval(() => { const a = g.palAudit(); window.__l4ps.trace.push([a.free ? 1 : 0, a.st, a.cd, a.vis ? 1 : 0, a.dist, a.tryIn].join('/')) }, 1000)
    })
    await page.waitForTimeout(14000)
    return page.evaluate(() => { const g = window.__capy; clearInterval(window.__l4ps.pin); clearInterval(window.__l4ps.tr)
      return { before: window.__l4psB, after: g.palAudit(), heard: window.__l4ps.heard, trace: window.__l4ps.trace, biome: g.biome.current, err: g.state.lastError || null } })
      .then(r => Object.assign(r, { before }))
  }
  out.sydney = await seed('sydney')
  await page.evaluate(() => window.__capy.hud.cross('pasto'))
  await page.waitForTimeout(9000)
  out.pasto = await seed('pasto')
  await page.evaluate((o) => fetch('/shot?name=l4-pal-seed.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
