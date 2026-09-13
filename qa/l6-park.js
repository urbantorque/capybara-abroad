async page => {
  // ---- THE HIDDEN PROP STAYS PARKED (L6, E8 / qa F4) ------------------------
  // Ten seconds standing at each spawn with no input; `solverSaves` read as a
  // delta over the window (it is cumulative and nothing resets it). Monaco's
  // `camera` and Hanoi's wine bottle were hidden DYNAMIC bodies falling for
  // ever under the world, one clamp a frame: +211 and +45 in nine seconds.
  // physHide parks STATIC now. The hidden props' depth and body type are in
  // the row so a regression says which prop and how.
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(5000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const out = { started: await page.evaluate(() => !!(window.__capy && window.__capy.state.started)), rows: {} }
  for (const name of ['monaco', 'hanoi', 'sydney', 'pasto']) {
    out.rows[name] = await page.evaluate(async (name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), cb = g.capy.body
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0)
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
      await new Promise(r => setTimeout(r, 1500))
      const s0 = g.state.solverSaves || 0
      await new Promise(r => setTimeout(r, 10000))
      const s1 = g.state.solverSaves || 0
      const hidden = []
      for (const p of g.props) {
        if (!p.hidden) continue
        if (p.biome && p.biome !== name) continue
        hidden.push({ type: p.type, y: +p.body.position.y.toFixed(0), bodyType: p.body.type, sleep: p.body.sleepState, until: +(p.hiddenUntil || 0).toFixed(0) })
      }
      return { biome: g.biome.current, saves: s1 - s0, hidden: hidden.slice(0, 8), hiddenN: hidden.length, lastError: g.state.lastError || null }
    }, name)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6-park.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
