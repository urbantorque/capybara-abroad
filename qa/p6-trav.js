async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1100, height: 660 })
  await page.goto('http://localhost:5188/')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  const out = { errs: [], where: {} }

  // The traveller is identified by their PALETTE, which is the only thing that
  // makes them the same person on screen. Reading the lines back would prove
  // four people exist; reading the colours proves it is one person.
  //
  // quay 3, sahara 8, goreme 13, hanoi 19 -> Digit3, Digit8, BracketLeft, Slash
  for (const [name, key] of [['quay', 'Digit3'], ['sahara', 'Digit8'],
                             ['goreme', 'BracketLeft'], ['hanoi', 'Slash']]) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(7000)
    out.where[name] = await page.evaluate(async (nm) => {
      const g = window.__capy
      const live = g.biome.current
      const L = (g.locals || []).filter(l => l.biome === live && l.fig)
      // whoever says the word the traveller says. Every one of them opens on a
      // line no other person in that chapter has.
      const pick = L.filter(l => {
        const s = JSON.stringify(l.lines || [])
        return /six months|I know you\. Sydney|Of course you are here|not even going to say it/.test(s)
      })
      if (!pick.length) return { biome: live, found: 0, locals: L.length }
      const t = pick[0]
      // the shirt colour, read off the MESH, so a figure spec that was ignored
      // is told apart from one that was applied
      let shirt = null, hat = null
      t.fig.group.traverse(o => {
        if (!o.isMesh || !o.material) return
        const w = o.geometry && o.geometry.parameters ? o.geometry.parameters.width : 0
        if (Math.abs(w - 0.50) < 1e-6) shirt = o.material.color.getHexString()
        if (Math.abs(w - 0.42) < 1e-6) hat = o.material.color.getHexString()
      })
      // ...and are they standing on the ground, or in it, or over it?
      let terr = null
      try { const a = g[live]; if (a && a.terrainHeight) terr = a.terrainHeight(t.x, t.z) } catch (e) {}
      // ...and can the animal actually reach them? Stand it at the anchor and
      // see where it settles: a person on a roof or inside a wall is a person
      // nobody will ever hear.
      g.capy.body.position.set(t.x, (terr === null ? t.y : terr) + 1.2, t.z + 2.2)
      g.capy.body.velocity.set(0, 0, 0)
      await new Promise(r => setTimeout(r, 2600))
      const d = Math.hypot(g.capy.position.x - t.x, g.capy.position.z - t.z)
      return { biome: live, found: pick.length, locals: L.length,
               at: [Math.round(t.x * 10) / 10, Math.round(t.z * 10) / 10],
               y: Math.round(t.y * 100) / 100,
               terr: terr === null ? null : Math.round(terr * 100) / 100,
               shirt: shirt, hat: hat,
               reachD: Math.round(d * 10) / 10,
               capyY: Math.round(g.capy.position.y * 100) / 100 }
    }, name)
  }

  out.errs = errs
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p6-trav.json', { method: 'POST', body: s })
  }, out)
}
