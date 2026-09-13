async page => {
  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 240)) })
  page.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 240)))
  // clear ONCE with an evaluate (trap 10 / 19: never an init script for a write-then-reload test)
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 })
  for (let i = 0; i < 120; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capyRunning && document.querySelector('.capyui-go')))) break }
  await page.waitForTimeout(1500)
  const initKey = await page.evaluate(() => { try { return Object.keys(localStorage) } catch (e) { return [String(e)] } })
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
  await page.waitForTimeout(4000)
  // do things: walk 4 s, wheek, cross to venice, complete a row there, cross to kowloon
  await page.keyboard.down('KeyW'); await page.waitForTimeout(3000); await page.keyboard.up('KeyW')
  await page.keyboard.press('KeyQ'); await page.waitForTimeout(800)
  const before = await page.evaluate(async () => {
    const g = window.__capy
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    g.hud.cross('venice'); await sleep(9000)
    // tick a Venice row through the real door
    let ticked = null
    try { const t = (window.CHAPTERS || []).length; } catch (e) {}
    try { g.hud.completeTask('wheek'); ticked = 'wheek' } catch (e) { ticked = 'err ' + e }
    await sleep(1500)
    return { biome: g.biome.current, ticked }
  })
  const before2 = await page.evaluate(async () => {
    const g = window.__capy
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    g.hud.cross('kowloon'); await sleep(9000)
    await page_noop()
    function page_noop() { return Promise.resolve() }
    await sleep(1500)
    let raw = null; try { raw = localStorage.getItem('capy3.journey.v1') } catch (e) { raw = 'ERR ' + e }
    let parsed = null; try { parsed = JSON.parse(raw) } catch (e) {}
    const keys = []; try { for (const k of Object.keys(localStorage)) keys.push(k) } catch (e) {}
    return { biome: g.biome.current, rawLen: raw ? raw.length : 0, keys, saveBiome: parsed && parsed.biome, tasks: parsed && parsed.tasks, seen: parsed && parsed.seen, ms: parsed && parsed.ms, nb: parsed && parsed.nb ? Object.keys(parsed.nb) : null, stow: parsed && parsed.stow, chapms: parsed && parsed.chapms, pos: [+g.capy.position.x.toFixed(1), +g.capy.position.z.toFixed(1)], time: +g.state.time.toFixed(1), lastError: g.state.lastError || null }
  })
  // reload and Carry on
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 })
  for (let i = 0; i < 120; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capyRunning && document.querySelector('.capyui-go')))) break }
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/l7r-qa-save-title.png' })
  const title = await page.evaluate(() => { const c = document.querySelector('.capyui-carry'); const b = document.querySelector('.capyui-go'); return { carry: c ? c.textContent.trim().slice(0, 80) : null, go: b ? b.textContent.trim().slice(0, 80) : null, keys: Object.keys(localStorage) } })
  await page.evaluate(() => { const b = document.querySelector('.capyui-carry') || document.querySelector('.capyui-go'); if (b) b.click() })
  for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
  await page.waitForTimeout(6000)
  const after = await page.evaluate(() => {
    const g = window.__capy
    let raw = null; try { raw = localStorage.getItem('capy3.journey.v1') } catch (e) {}
    let parsed = null; try { parsed = JSON.parse(raw) } catch (e) {}
    const todo = document.querySelector('.capyui-todo'); const rows = todo ? [...todo.querySelectorAll('[class*=row],li')].map(e => e.textContent.trim().slice(0, 60)) : []
    return { started: g.state.started, biome: g.biome.current, saveBiome: parsed && parsed.biome, tasks: parsed && parsed.tasks, seen: parsed && parsed.seen, ms: parsed && parsed.ms, nb: parsed && parsed.nb ? Object.keys(parsed.nb) : null, pos: [+g.capy.position.x.toFixed(1), +g.capy.position.z.toFixed(1)], time: +g.state.time.toFixed(1), lastError: g.state.lastError || null, todoRows: rows.slice(0, 8), journeyMs: g.state.journeyMs || null }
  })
  await page.screenshot({ path: 'qa/l7r-qa-save-after.png' })
  // hostile: v:1 with tasks: 5 (the L6 gap) and a NaN number
  const hostile = []
  for (const [tag, file] of [['tasks5', '{"v":1,"tasks":5,"seen":[0],"biome":"venice"}'], ['nan', '{"v":1,"tasks":["wheek"],"seen":[0,9],"ms":1e309,"chapms":{"venice":-1e99},"biome":"kowloon","nb":{"venice":{"d":"x","f":5}},"stow":{"kind":"pigeon","from":"venice"}}'], ['badstow', '{"v":1,"tasks":[],"seen":[0],"biome":"sydney","stow":{"kind":"dragon","from":"nowhere"}}'], ['biomeUnknown', '{"v":1,"tasks":[],"seen":[0],"biome":"atlantis"}']]) {
    await page.evaluate((f) => { localStorage.setItem('capy3.journey.v1', f) }, file)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 })
    for (let i = 0; i < 120; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capyRunning && document.querySelector('.capyui-go')))) break }
    await page.waitForTimeout(1500)
    const card = await page.evaluate(() => { const c = document.querySelector('.capyui-carry'); const b = document.querySelector('.capyui-go'); return { carry: c ? c.textContent.trim().slice(0, 60) : null, go: b ? b.textContent.trim().slice(0, 40) : null, keys: Object.keys(localStorage) } })
    await page.evaluate(() => { const b = document.querySelector('.capyui-carry') || document.querySelector('.capyui-go'); if (b) b.click() })
    for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
    await page.waitForTimeout(7000)
    const r = await page.evaluate(() => {
      const g = window.__capy
      const keys = Object.keys(localStorage)
      let raw = null; try { raw = localStorage.getItem('capy3.journey.v1') } catch (e) {}
      let comp = null; try { comp = g.companion ? (typeof g.companion === 'function' ? g.companion() : g.companion) : null } catch (e) { comp = 'err' }
      return { started: g && g.state.started, biome: g && g.biome.current, keys, rawNow: raw ? raw.slice(0, 160) : null, compKind: comp && comp.kind || null, lastError: g && g.state.lastError || null, err: document.querySelector('#err') ? document.querySelector('#err').textContent.slice(0, 120) : null, toasts: [...document.querySelectorAll('.capyui-toast')].map(e => e.textContent.trim().slice(0, 80)) }
    })
    hostile.push(Object.assign({ tag, card }, r, { errsSoFar: errs.length }))
    await page.evaluate(() => { try { localStorage.removeItem('capy3.journey.broken.v1') } catch (e) {} })
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=l7r-qa-save.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, { initKey, before, before2, title, after, hostile, errs: errs.slice(0, 30), errN: errs.length })
}
