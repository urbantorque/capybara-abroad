async page => {
  await page.reload()
  await page.waitForTimeout(4500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const t0 = await page.evaluate(() => {
    const g = window.__capy
    window.__p0 = g.npcs.filter(r => r && r.group).map(r => [r.id, r.group.position.x, r.group.position.z])
    return { started: g.state.started, paused: g.state.paused, hidden: document.hidden, biome: g.biome.current }
  })
  for (let i = 0; i < 5; i++) {
    await page.keyboard.down('w'); await page.waitForTimeout(900); await page.keyboard.up('w')
    await page.keyboard.press('q')
    await page.keyboard.down('a'); await page.waitForTimeout(600); await page.keyboard.up('a')
    await page.keyboard.press(' ')
    await page.waitForTimeout(500)
  }
  const t1 = await page.evaluate(() => {
    const g = window.__capy
    let moved = 0
    const now = {}
    g.npcs.forEach(r => { if (r && r.group) now[r.id] = [r.group.position.x, r.group.position.z] })
    for (const [id, x, z] of window.__p0) {
      const n = now[id]; if (!n) continue
      if (Math.hypot(n[0] - x, n[1] - z) > 0.5) moved++
    }
    return { paused: g.state.paused, moved, npcs: window.__p0.length,
             tasks: g.hud && g.hud.doneCount ? g.hud.doneCount() : -1,
             err: g.state.lastError || null, saves: g.state.solverSaves || 0,
             score: Math.round(g.state.score || 0) }
  })
  // now open the journal and confirm the world actually freezes
  await page.keyboard.press('Tab')
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    const g = window.__capy
    window.__p1 = g.npcs.filter(r => r && r.group).map(r => [r.id, r.group.position.x, r.group.position.z])
  })
  await page.waitForTimeout(3000)
  const t2 = await page.evaluate(() => {
    const g = window.__capy
    const now = {}
    g.npcs.forEach(r => { if (r && r.group) now[r.id] = [r.group.position.x, r.group.position.z] })
    let moved = 0
    for (const [id, x, z] of window.__p1) { const n = now[id]; if (!n) continue; if (Math.hypot(n[0]-x, n[1]-z) > 0.05) moved++ }
    return { paused: g.state.paused, movedWhilePaused: moved }
  })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1200)
  const t3 = await page.evaluate(() => ({ paused: window.__capy.state.paused, err: window.__capy.state.lastError || null }))
  await page.evaluate(async (o) => { await fetch('/shot?name=smoke.json', { method: 'POST', body: btoa(JSON.stringify(o, null, 1)) }) }, { t0, t1, t2, t3 })
}
