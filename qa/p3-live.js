async page => {
  const out = {}
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  await page.setViewportSize({ width: 1280, height: 720 })
  // NOT an addInitScript: it fires on EVERY navigation, so the reload that
  // this probe uses to prove the save survives would wipe the very file it is
  // checking — and it reported inc:null after a run that had just written
  // inc:{1:1}. See headless-qa-harness trap 10. Cleared once, by hand.
  await page.goto('http://localhost:5188/')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })

  // ---- 1. the countdown reaches the paper: walk the arrow with F ----
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit7')          // Iceland: the whale, 54 s
  await page.waitForTimeout(5000)
  const seen = []
  for (let i = 0; i < 12; i++) {
    const c = await page.evaluate(() => {
      const e = document.querySelector('.capyui-clue')
      return e ? e.textContent : ''
    })
    seen.push(c.replace(/\n/g, ' | ').slice(0, 90))
    if (/next in/.test(c)) break
    await page.keyboard.press('KeyF')
    await page.waitForTimeout(420)
  }
  out.icelandClues = seen
  out.foundCountdown = seen.some(s => /next in/.test(s))
  // ...and it counts DOWN
  if (out.foundCountdown) {
    const a = await page.evaluate(() => document.querySelector('.capyui-clue').textContent)
    await page.waitForTimeout(4200)
    const b = await page.evaluate(() => document.querySelector('.capyui-clue').textContent)
    const n = s => { const m = /next in (\d+)/.exec(s); return m ? +m[1] : NaN }
    out.countdown = { first: a.replace(/\n/g, ' | '), later: b.replace(/\n/g, ' | '),
                      fell: n(a) > n(b) }
  }

  // ---- 2. an incident, caused for real, counted and saved ----
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')          // Sydney: the forecourt crowd
  await page.waitForTimeout(5000)
  out.incident = await page.evaluate(async () => {
    const g = window.__capy
    // Stand in the crowd so findPeople() answers, then throw everything loose
    // that is near it — an incident is three witnessed impacts inside 22 m.
    // Stand where the PEOPLE are, not where the lawn is: the chain is gated on
    // findPeople() > 0, which walks game.npcs' group positions. Pick the densest
    // 16 m disc around any of them and go there.
    let bx = 0, bz = 0, bn = -1
    const arr = g.npcs || []
    for (let i = 0; i < arr.length; i++) {
      const q = arr[i]; if (!q || !q.group) continue
      let n = 0
      for (let k = 0; k < arr.length; k++) {
        const w = arr[k]; if (!w || !w.group) continue
        if (Math.hypot(w.group.position.x - q.group.position.x, w.group.position.z - q.group.position.z) < 14) n++
      }
      if (n > bn) { bn = n; bx = q.group.position.x; bz = q.group.position.z }
    }
    g.capy.body.position.set(bx + 1.5, g.capy.position.y + 1, bz + 1.5)
    await new Promise(r => setTimeout(r, 1800))
    const cp = g.capy.position
    // `game.props` is the record list; an impact only counts as an incident if
    // the prop is `disturbed`, which is props.js's word for "the capybara did
    // this". Setting it by hand is exactly what a barge does, and it is the
    // only part of the chain a script cannot do with a keypress.
    const near = (g.props || []).filter(p => {
      if (!p || !p.body || !(p.mass > 0)) return false
      const d = Math.hypot(p.body.position.x - cp.x, p.body.position.z - cp.z)
      return d < 24
    })
    const fired = []
    for (let k = 0; k < Math.min(near.length, 8); k++) {
      const p = near[k]
      p.disturbed = true
      p.lastCapyTouch = g.state.time
      p.body.wakeUp()
      // Straight down, hard: the chain wants an IMPACT above sysINC_HIT
      // (2.6 m/s), and a prop lobbed upward is only fast when it lands.
      p.body.position.y += 3.2
      p.body.velocity.set(0, -9, 0)
      p.body.angularVelocity.set(5, 5, 5)
      await new Promise(r => setTimeout(r, 1100))
      fired.push(p.type || '?')
    }
    await new Promise(r => setTimeout(r, 2500))
    let file = {}
    try { file = JSON.parse(localStorage.getItem('capy3.journey.v1') || '{}') } catch (e) {}
    let peopleNear = 0; for (const q of (g.npcs||[])) { if (q && q.group && Math.hypot(q.group.position.x-cp.x, q.group.position.z-cp.z) < 16) peopleNear++ }
    return { propsNear: near.length, thrown: fired.length, peopleNear: peopleNear, types: fired,
             inc: file.inc || null, scn: file.scn || null,
             hasIncKey: Object.prototype.hasOwnProperty.call(file, 'inc'),
             hasScnKey: Object.prototype.hasOwnProperty.call(file, 'scn') }
  })

  // ---- 3. ...and it survives a reload ----
  await page.reload()
  await page.waitForTimeout(5200)
  out.afterReload = await page.evaluate(() => {
    let file = {}
    try { file = JSON.parse(localStorage.getItem('capy3.journey.v1') || '{}') } catch (e) {}
    return { inc: file.inc || null, scn: file.scn || null }
  })

  out.errs = errs
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p3-live.json', { method: 'POST', body: s })
  }, out)
}
