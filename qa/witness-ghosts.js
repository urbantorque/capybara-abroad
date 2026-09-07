async page => {
  // ---------------------------------------------------------------------------
  // qa/witness-ghosts.js — DOES THE CHAIN ARM WHERE NOBODY IS?
  //
  // `incAdd` refuses unless `findPeople` answers non-zero, and the chain's own
  // comment says that is "why the Drift — a chapter with nobody in it — can
  // never produce one of these however much is thrown off how many islands".
  //
  // But `findPeople` filters `game.locals` by chapter and walks `game.npcs`
  // WITHOUT a chapter test, and `game.npcs` accumulates: Sydney's thirty-eight
  // tourists, gardeners and commuters stay in it for the rest of the session,
  // at their Sydney coordinates, which several other chapters' spawns are
  // within a few metres of.
  //
  // So: go to the chapters that are supposed to be empty, disturb something,
  // and see whether the pips light. The pips are B4's and they are the visible
  // face of `incN`, so this needs no new hook.
  // ---------------------------------------------------------------------------
  const ORDER = ['drift', 'pantanal', 'cave', 'antarctic', 'hanoi']
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  // Chapter one FIRST and on purpose: it is what puts Sydney's cast into
  // `game.npcs` and leaves it there. A run that never visited Sydney would
  // measure a clean array and report no bug.
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(8000)

  const rows = []
  for (const b of ORDER) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(10000)
    const r = await page.evaluate((arg) => {
      const g = window.__capy
      const p = g.capy.position
      const live = g.biome.current
      // Who is really here, by the same rule npc.js's own speaker search uses.
      let localsHere = 0
      for (const L of (g.locals || [])) {
        if (L && L.biome === live && Math.hypot(L.x - p.x, L.z - p.z) < 16) localsHere++
      }
      // ...and who `findPeople` would ALSO count: every `game.npcs` record in
      // range, whichever chapter it belongs to.
      let castInRange = 0, castVisible = 0
      for (const q of (g.npcs || [])) {
        const gp = q && q.group && q.group.position
        if (!gp) continue
        if (Math.hypot(gp.x - p.x, gp.z - p.z) >= 16) continue
        castInRange++
        let vis = true
        for (let o = q.group; o && vis; o = o.parent) if (!o.visible) vis = false
        if (vis) castVisible++
      }
      // Disturb something, three times, right here.
      for (let i = 0; i < 3; i++) {
        g.events.emit('prop:destroy', {
          prop: { disturbed: true, id: 'ghost-' + arg.b + '-' + i,
                  body: { position: { x: p.x, y: p.y, z: p.z } } }
        })
      }
      return { biome: live, want: arg.b, localsHere: localsHere,
               castInRange: castInRange, castVisible: castVisible }
    }, { b: b })
    await page.waitForTimeout(900)
    const pips = await page.evaluate(() => {
      const el = document.querySelector('.capyui-pips')
      const bars = [...document.querySelectorAll('.capyui-pips b')]
      return { on: !!(el && el.classList.contains('on')),
               lit: bars.filter(x => x.classList.contains('lit')).length }
    })
    rows.push(Object.assign(r, { pips: pips }))
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=witness-ghosts.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs })
}
