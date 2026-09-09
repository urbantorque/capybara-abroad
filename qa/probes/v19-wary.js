async page => {
  await page.evaluate(() => { try { localStorage.removeItem('capy3.journey.v1') } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(4500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const rep = {}
    const maxWary = () => {
      let m = 0
      for (const h of g.npcs) if (h && (h.wary || 0) > m) m = h.wary
      return +m.toFixed(2)
    }
    rep.before = { maxWary: maxWary(), heat: g.npcHeat(g.capy.position.x, g.capy.position.z, 20) }
    // stand next to the crowd and startle them the way the game does
    let near = null, bd = 1e9
    for (const h of g.npcs) {
      if (!h || !h.group) continue
      const d = h.group.position.lengthSq()
      if (d < bd) { bd = d; near = h }
    }
    const b = g.capy.body
    b.position.set(near.group.position.x + 1.2, 1.2, near.group.position.z + 1.2)
    b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false)
    // a wheek is the loudest thing the animal owns
    for (let k = 0; k < 3; k++) {
      g.events.emit('capy:wheek', { position: g.capy.position })
      for (let i = 0; i < 40; i++) g.tick(1 / 60, false)
    }
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    rep.afterWheek = { maxWary: maxWary(), heat: g.npcHeat(g.capy.position.x, g.capy.position.z, 20) }
    // and it fades
    for (let i = 0; i < 60 * 20; i++) g.tick(1 / 60, false)
    rep.after20s = { maxWary: maxWary(), heat: g.npcHeat(g.capy.position.x, g.capy.position.z, 20) }
    for (let i = 0; i < 60 * 15; i++) g.tick(1 / 60, false)
    rep.after35s = { maxWary: maxWary(), heat: g.npcHeat(g.capy.position.x, g.capy.position.z, 20) }
    rep.err = g.state.lastError || null
    rep.localsHaveWary = g.locals.filter(l => (l.wary || 0) > 0).length
    await fetch('/shot?name=v19wary.json', {
      method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(rep, null, 1)))),
    })
    return 'ok'
  })
  return out
}
