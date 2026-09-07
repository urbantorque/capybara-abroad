async page => {
  // ---------------------------------------------------------------------------
  // qa/toybox-stock.js — WHAT IS THERE TO PLAY WITH? (ROADMAP-FUN, item 4)
  //
  // B9 proposes to make `receive` mean something and to put `fragile:`/`spill:`
  // on fifteen more types. Both are claims about props that a chapter BUILDS,
  // and the type table cannot answer that: it is one shared table read by
  // nineteen worlds, and B5 established that `game.props` accumulates across
  // crossings. Everything below is filtered on `q.biome === live` and on the
  // body still being in the world.
  // ---------------------------------------------------------------------------
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)

  const NAMES = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                 'venice','kowloon','palawan','goreme','manly','pantanal','cave',
                 'antarctic','monaco','hanoi']
  const rows = []
  for (const n of NAMES) {
    await page.evaluate((b) => { window.__capy.hud.cross(b) }, n)
    await page.waitForTimeout(9000)
    const r = await page.evaluate(() => {
      const g = window.__capy
      const live = g.biome.current
      const sp = g.capy.position
      const hist = {}
      let total = 0, frag = 0, spil = 0, recv = 0, cont = 0, vess = 0
      let nearCont = 1e9
      // The three types that are actually a container you could put a thing IN,
      // as opposed to the ten that carry `receive:` — which is receiveShadow.
      const CONT = { bin: 1, basket: 1, esky: 1 }
      for (const q of (g.props || [])) {
        if (!q || q.biome !== live || !q.body || !q.body.world) continue
        if (q.removed || q.hidden) continue
        total++
        hist[q.type] = (hist[q.type] || 0) + 1
        const d = g.physics.typeOf(q.type)
        if (d && d.fragile) frag++
        if (d && d.spill) spil++
        if (d && d.receive) recv++
        if (d && d.vessel) vess++
        if (CONT[q.type]) {
          cont++
          const dd = Math.hypot(q.body.position.x - sp.x, q.body.position.z - sp.z)
          if (dd < nearCont) nearCont = dd
        }
      }
      return { b: live, total, frag, spil, recv, cont, vess,
               fun: (frag + spil) > 0,
               nearCont: nearCont > 1e8 ? null : +nearCont.toFixed(1),
               hist }
    })
    rows.push(Object.assign({ want: n }, r))
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=toybox-stock.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs })
}
