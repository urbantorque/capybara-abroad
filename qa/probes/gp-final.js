async page => {
  await page.reload()
  await page.waitForTimeout(4500)
  const errs = []
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  page.on('console', m => { if (m.type() === 'error') errs.push('C: ' + m.text().slice(0, 160)) })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1200)
  // the sprint-past
  const rush = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('kowloon')
    await new Promise(r => setTimeout(r, 500))
    const L = g.locals.filter(x => x.biome === 'kowloon')[0]
    if (!L) return { skip: true }
    L.cd = 0; L.fl = 0; L.flV = 0; L.last = ''; L.rushWas = false
    const b = g.capy.body
    b.position.set(L.x - 8, (L.y || 0) + 0.4, L.z)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    let peak = 0, said = ''
    for (let i = 0; i < 130; i++) {
      // drive it past them at 8 m/s by hand
      b.velocity.set(8, b.velocity.y, 0)
      await new Promise(r => requestAnimationFrame(r))
      if (L.fl < peak) peak = L.fl
      if (L.last) said = L.last
    }
    return { peak: +peak.toFixed(3), said }
  })
  const names = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift','venice',
                 'kowloon','palawan','goreme','manly','pantanal','cave','antarctic']
  const rows = {}
  for (const n of names) {
    await page.evaluate((nm) => {
      const g = window.__capy
      if (g.biome.current !== nm) g.biome.switchTo(nm)
      const s = g.biome.spawnOf(nm)
      const b = g.capy.body
      b.position.set(s.x, s.y, s.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.state.lastError = null
      g.__f0 = 0
    }, n)
    await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft')
    await page.waitForTimeout(1400)
    await page.keyboard.press('KeyQ'); await page.keyboard.press('KeyE'); await page.keyboard.press('Space')
    await page.waitForTimeout(1000)
    await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft')
    // measure fps over a second of settled play
    const r = await page.evaluate(async () => {
      const g = window.__capy
      let n = 0
      const t0 = performance.now()
      while (performance.now() - t0 < 1000) { await new Promise(r => requestAnimationFrame(r)); n++ }
      const c = g.camera
      const api = g.biome.current === 'sydney' ? g.env : g[g.biome.current]
      const th = (api && typeof api.terrainHeight === 'function') ? api.terrainHeight(c.position.x, c.position.z) : 0
      return { fps: n, fov: +c.fov.toFixed(1), clear: +(c.position.y - th).toFixed(2),
               locals: g.locals.filter(L => L.biome === g.biome.current).length,
               saves: g.state.solverSaves || 0, err: g.state.lastError || null }
    })
    rows[n] = r
  }
  const payload = JSON.stringify({ rush, rows, errs: errs.slice(0, 20) })
  await page.evaluate(async (b) => {
    await fetch('/shot?name=gp-final.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(b))) })
  }, payload)
}
