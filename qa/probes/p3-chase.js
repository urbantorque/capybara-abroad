async page => {
  const out = {}
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  await page.setViewportSize({ width: 1280, height: 720 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })

  const KEYS = { sydney: 'Digit1', iceland: 'Digit7', venice: 'Digit0',
                 kowloon: 'Minus', palawan: 'Equal', goreme: 'BracketLeft',
                 hanoi: 'Slash', kyoto: 'Digit4' }

  const enter = async (key) => {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(5000)
  }

  // ---- 1. the timed glyph and the par line on the paper ----
  await enter(KEYS.kyoto)
  out.kyoto = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.capyui-task')).filter(li => {
      const cs = getComputedStyle(li)
      return cs.display !== 'none' && !li.classList.contains('capyui-hidden')
    }).map(li => ({
      txt: (li.querySelector('.capyui-txt') || {}).textContent || '',
      timed: !!li.querySelector('.capyui-meas')
    }))
    const clue = document.querySelector('.capyui-clue')
    return { rows: rows, clue: clue ? clue.textContent : null,
             clueWS: clue ? getComputedStyle(clue).whiteSpace : null }
  })

  // ---- 2. nextIn on the six cycle chapters ----
  out.nextIn = {}
  for (const [name, key] of [['iceland', KEYS.iceland], ['venice', KEYS.venice],
                             ['kowloon', KEYS.kowloon], ['palawan', KEYS.palawan],
                             ['goreme', KEYS.goreme], ['hanoi', KEYS.hanoi]]) {
    await enter(key)
    out.nextIn[name] = await page.evaluate((n) => {
      const g = window.__capy
      const api = g[n === 'venice' ? 'venice' : n]
      const ids = { iceland: 'the-whale', venice: 'mirror-swim', kowloon: 'symphony',
                    palawan: 'the-bloom', goreme: 'sunrise', hanoi: 'the-train' }
      let a = null
      try { a = api && typeof api.nextIn === 'function' ? api.nextIn(ids[n]) : 'NO HOOK' } catch (e) { a = 'THREW ' + e.message }
      let bogus = null
      try { bogus = api && api.nextIn ? api.nextIn('not-a-task') : null } catch (e) { bogus = 'THREW' }
      return { biome: g.biome.current, secs: a, bogus: bogus }
    }, name)
  }

  // ---- 3. the countdown reaches the paper, and it counts DOWN ----
  await enter(KEYS.hanoi)
  out.hanoiClue = await page.evaluate(async () => {
    const g = window.__capy
    const read = () => { const c = document.querySelector('.capyui-clue'); return c ? c.textContent : '' }
    // pin the arrow at the train row so it is the top row
    if (typeof g.hud.pinTask === 'function') g.hud.pinTask('the-train')
    const a = read()
    await new Promise(r => setTimeout(r, 4200))
    const b = read()
    return { first: a, later: b }
  })

  // ---- 4. an incident is counted and survives a reload ----
  await enter(KEYS.sydney)
  out.incident = await page.evaluate(async () => {
    const g = window.__capy
    const before = JSON.parse(localStorage.getItem('capy3.journey.v1') || '{}')
    return { fileInc: before.inc || null, fileScn: before.scn || null }
  })

  // ---- 5. the ghost cap ----
  out.ghost = await page.evaluate(() => {
    const g = window.__capy
    return g.hud.ghostAudit ? g.hud.ghostAudit() : null
  })

  // ---- 6. record audit still clean ----
  out.records = await page.evaluate(() => {
    const g = window.__capy
    return g.hud.recordAudit ? g.hud.recordAudit() : null
  })

  out.errs = errs
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p3-chase.json', { method: 'POST', body: s })
  }, out)
}
