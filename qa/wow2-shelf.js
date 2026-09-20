async page => {
  // ROADMAP-WOW2 N1 — THE SHELF IN THE WORLD. Three saves, 0/7/19 keeps,
  // each a fresh boot so sysShelfStage runs from the branch that never fires
  // biome:enter (startGame's non-restore/restore Sydney branch). Forced by
  // writing real `tasks` ids into the save (game.tasksInChapter + a real
  // completeTask path on restore) rather than faking keepHeld directly — a
  // state assertion, not a live-earn, per the brief.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  const out = { errs }

  async function bootWith(n) {
    await page.addInitScript((nn) => {
      try {
        localStorage.clear()
        if (nn > 0) {
          // built AFTER the first boot below hands us tasksInChapter — see
          // the two-pass dance in run(): pass 1 (n=0) has no tasks to seed.
        }
      } catch (e) {}
    }, n)
  }

  // ---- pass 1: a fresh file, nothing kept ---------------------------------
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(4500)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(4500)
  out.zero = await page.evaluate(() => {
    const g = window.__capy
    return { started: g.state.started, biome: g.biome.current, audit: g.shelfAudit() }
  })

  // grab every task id per chapter now, while a live game is up, then reload
  // fresh into a save that has completed all of chapters 1..7
  const idsByChap = await page.evaluate(() => {
    const g = window.__capy
    const out = {}
    for (let k = 1; k <= 19; k++) {
      try { out[k] = (g.tasksInChapter(k) || []).map(t => t.id || t) } catch (e) { out[k] = [] }
    }
    return out
  })

  async function bootKept(chaps) {
    const ids = []
    for (const k of chaps) for (const id of (idsByChap[k] || [])) ids.push(id)
    await page.addInitScript((idsIn) => {
      try {
        localStorage.clear()
        localStorage.setItem('capy3.journey.v1', JSON.stringify({ v: 1, tasks: idsIn, seen: [], recs: {}, ms: 0 }))
      } catch (e) {}
    }, ids)
    await page.goto('http://localhost:5188/index.html')
    await page.waitForTimeout(4500)
    // a save with tasks on it swaps Begin for Carry on (capyui-carry, not
    // capyui-go — the .alt "Go somewhere else" button is the first
    // .capyui-go in the DOM once a file exists, and only turns the page)
    await page.evaluate(() => {
      const carry = document.querySelector('.capyui-carry')
      if (carry) carry.click(); else document.querySelector('.capyui-go').click()
    })
    await page.waitForTimeout(4500)
    return page.evaluate(() => {
      const g = window.__capy
      return {
        started: g.state.started, biome: g.biome.current,
        audit: g.shelfAudit(), shelfSpokenN: g.state.shelfSpokenN || 0,
      }
    })
  }

  out.seven = await bootKept([1, 2, 3, 4, 5, 6, 7])
  // a second read with NO reload (still the same page/session): staying in
  // Sydney and re-triggering sysShelfStage must not speak any line twice
  out.sevenAgain = await page.evaluate(() => {
    const g = window.__capy
    g.hud.cross('sydney')
    return { audit: g.shelfAudit() }
  })
  await page.waitForTimeout(500)
  out.sevenAgainSpoken = await page.evaluate(() => window.__capy.state.shelfSpokenN || 0)

  out.nineteen = await bootKept([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19])

  // ---- one prop, read back where the shelf math says it should be --------
  out.oneProp = await page.evaluate(() => {
    const g = window.__capy
    const p = g.physics.keepOut('sydney')
    const slot = g.shelfAudit().slots[0]
    return p ? { x: p.body.position.x, y: p.body.position.y, z: p.body.position.z, slot } : null
  })

  await page.screenshot({ path: 'qa/wow2-shelf-19.png' })

  await page.evaluate((o) => {
    const enc = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    fetch('/shot?name=wow2-shelf', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: enc })
  }, out)
}
