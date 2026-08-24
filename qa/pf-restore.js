// PAYOFF batch 1, job 1(a): SAVE AND RELOAD AT HOSTILE MOMENTS.
//
// The save file is deliberately a record of what you have DONE and not of where
// your feet are, so none of these should restore a pose — what they must do is
// survive being written from inside a transient state, come back in the right
// chapter with the right ticks, and not throw on the way in or out.
//
// Four moments: mid-carrier (riding something), mid-dive (underwater), mid-act
// (a multi-act chapter half closed) and mid-ceremony (inside the 2.9 s window
// after the last task of a chapter, which is where the act-card scheduling trap
// lives).
async page => {
  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) })
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200)))

  const boot = async () => {
    await page.reload()
    await page.waitForTimeout(6000)
  }
  const resume = async () => {
    // page one of the card: a press anywhere that is not a ticket carries on
    await page.mouse.click(640, 400)
    await page.waitForTimeout(4500)
  }
  const snap = () => page.evaluate(() => {
    const g = window.__capy
    const done = [...document.querySelectorAll('.capyui-todo li.capyui-task')]
      .filter(li => li.classList.contains('capyui-done')).length
    return {
      biome: g.biome.current,
      score: g.state.score,
      err: g.state.lastError ? String(g.state.lastError).slice(0, 160) : null,
      save: (localStorage.getItem('capy3.journey.v1') || '').length,
      head: (document.querySelector('.capyui-todo h2') || {}).textContent || null,
      rows: [...document.querySelectorAll('.capyui-todo li.capyui-task')]
        .filter(li => !li.classList.contains('capyui-hidden'))
        .map(li => { const t = li.querySelector('.capyui-txt'); return t ? t.textContent : '?' }),
      done,
      y: +g.capy.position.y.toFixed(2),
      depth: +(g.capy.depth || 0).toFixed(2),
      carried: !!g.capy.carriedBy,
    }
  })

  const R = { moments: [], issues: [] }
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(800)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await boot(); await resume()

  // ---- 1. MID-ACT: half of Venice, act 1 only ----------------------------
  await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('venice')
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
    for (const id of ['to-venice', 'spritz-theft', 'pigeon-storm', 'the-well']) g.completeTask(id)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    await new Promise(r => setTimeout(r, 900))
  })
  const a0 = await snap()
  await boot(); await resume()
  const a1 = await snap()
  R.moments.push({ moment: 'mid-act venice', before: a0, after: a1 })
  if (a1.biome !== 'venice') R.issues.push('mid-act: resumed in ' + a1.biome + ', not venice')
  if (a1.score !== a0.score) R.issues.push('mid-act: score ' + a0.score + ' -> ' + a1.score)
  if (a1.head !== a0.head) R.issues.push('mid-act: paper head ' + a0.head + ' -> ' + a1.head)

  // ---- 2. MID-CARRIER: on the condor over Pasto --------------------------
  const c0 = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('pasto')
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
    g.completeTask('to-pasto')
    // TWO summons: the first brings it in and it circles high, the second drops
    // it into reach. And the grab is a RISING EDGE — condorTryMount reads
    // input.actionPressed, so holding input.action for a thousand frames never
    // boards the bird.
    g.condor.summon()
    for (let i = 0; i < 1200 && g.condor.state !== 'circling'; i++) g.tick(1 / 60, false)
    g.condor.summon()
    for (let i = 0; i < 2400 && !g.condor.talonInReach(); i++) g.tick(1 / 60, false)
    for (let i = 0; i < 900 && !g.capy.carriedBy; i++) {
      const p = (i % 6 === 0) && g.condor.talonInReach()
      g.input.action = p; g.input.actionPressed = p
      g.tick(1 / 60, false)
    }
    g.input.action = false; g.input.actionPressed = false
    for (let i = 0; i < 180; i++) g.tick(1 / 60, false)   // ...and get some air under it
    await new Promise(r => setTimeout(r, 900))
    return { carried: !!g.capy.carriedBy, mounted: !!g.condor.mounted,
             state: g.condor.state, y: +g.capy.position.y.toFixed(2) }
  })
  const b0 = await snap()
  await boot(); await resume()
  const b1 = await snap()
  R.moments.push({ moment: 'mid-carrier pasto', forced: c0, before: b0, after: b1 })
  if (!c0.carried) R.issues.push('mid-carrier: NEVER MOUNTED — the moment was not tested')
  if (b1.err) R.issues.push('mid-carrier: lastError ' + b1.err)
  if (b1.carried) R.issues.push('mid-carrier: still carriedBy after a reload')

  // ---- 3. MID-DIVE: under the water in Palawan ---------------------------
  const d0 = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('palawan')
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
    // MEASURED (qa/pf-probe.js): the bay is dry to the south of the spawn and
    // swimmable to the north; 60 m out is 5.6 m of dive. The dive itself is
    // capySwimming + a HELD input.action, which is why this holds it.
    const sp = g.biome.spawnOf('palawan'), b = g.capy.body
    b.position.set(sp.x, sp.y + 2, sp.z - 60)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    b.velocity.set(0, 0, 0)
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
    for (let i = 0; i < 200; i++) { g.input.action = true; g.tick(1 / 60, false) }
    g.input.action = false
    await new Promise(r => setTimeout(r, 400))
    return { swimming: !!g.capy.swimming, depth: +(g.capy.depth || 0).toFixed(2),
             y: +g.capy.position.y.toFixed(2) }
  })
  const e0 = await snap()
  await boot(); await resume()
  const e1 = await snap()
  R.moments.push({ moment: 'mid-dive palawan', forced: d0, before: e0, after: e1 })
  if (!(d0.depth > 1)) R.issues.push('mid-dive: NEVER WENT UNDER (depth ' + d0.depth + ') — the moment was not tested')
  if (e1.err) R.issues.push('mid-dive: lastError ' + e1.err)

  // ---- 4. MID-CEREMONY: reload inside the window after the last task -----
  const f0 = await page.evaluate(async () => {
    const g = window.__capy
    const src = await (await fetch('/src/shared.js')).text()
    const tb = src.slice(src.indexOf('export const TASKS = ['),
                         src.indexOf('\n];', src.indexOf('export const TASKS = [')))
    const re = /\{\s*id:\s*'([^']+)'[^}]*?chapter:\s*(\d+)([^}]*)\}/g
    const ids = []
    let m
    while ((m = re.exec(tb))) if (Number(m[2]) === 4) ids.push(m[1])
    g.biome.switchTo('kyoto')
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
    for (let i = 0; i < ids.length - 1; i++) g.completeTask(ids[i])
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
    await new Promise(r => setTimeout(r, 400))
    g.completeTask(ids[ids.length - 1])          // the tick that closes the chapter
    // Past sysSAVE_DEBOUNCE (700 ms) and well inside sysACT_CARD_WAIT (2.9 s).
    // Before the wall-clock fix this tick — a marquee, so slow motion is on —
    // did not reach the file until 1046 ms and the whole chapter came back one
    // task short. Anything under 700 ms would be an unfair test of a debounce.
    await new Promise(r => setTimeout(r, 1200))
    return { n: ids.length }
  })
  const g0 = await snap()
  await boot(); await resume()
  await page.waitForTimeout(2000)
  const g1 = await page.evaluate(() => {
    const g = window.__capy
    return {
      biome: g.biome.current, score: g.state.score,
      err: g.state.lastError ? String(g.state.lastError).slice(0, 160) : null,
      rows: [...document.querySelectorAll('.capyui-todo li.capyui-task')]
        .filter(li => !li.classList.contains('capyui-hidden'))
        .map(li => { const t = li.querySelector('.capyui-txt'); return t ? t.textContent : '?' }),
    }
  })
  R.moments.push({ moment: 'mid-ceremony kyoto', forced: f0, before: g0, after: g1 })
  if (g1.err) R.issues.push('mid-ceremony: lastError ' + g1.err)
  if (g1.score !== g0.score) R.issues.push('mid-ceremony: score ' + g0.score + ' -> ' + g1.score)
  if (!g1.rows.some(t => /the way on/i.test(t))) R.issues.push('mid-ceremony: no way-on row after restore — ' + JSON.stringify(g1.rows))

  R.errs = errs.slice(0, 25)
  await page.evaluate(async o => {
    await fetch('/shot?name=pfrestore.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, R)
}
