async page => {
  // L6 F4 — THE PAGE, LOOKED AT. A seeded notebook: Sydney passed through
  // (done 0 -> a blank line), Pasto left at one row, Kyoto left with the
  // marquee and a regular; started in the Quay (a cameo chapter, unmet).
  // The journal is opened, the fold scrolled into view: qa/l6-notebook-look.png
  // and the entries as text. qa/l6-notebook-look.json
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(2500)
  const f = (o) => Object.assign({ done: 0, total: 10, inc: 0, scn: 0, pho: 0, fed: 0, pas: 0, ln: 0, err: 0, tier: 0, wow: 0, keep: 0, enough: 0, met: 0, par: 0 }, o)
  await page.evaluate((file) => { localStorage.clear(); localStorage.setItem('capy3.journey.v1', JSON.stringify(file)) },
    { v: 1, tasks: ['wheek', 'condor-ride', 'lantern-topple'], seen: [1, 2, 3, 4], recs: {}, told: 1, ms: 600000, chapms: {}, finds: [], foundAt: {}, biome: 'quay', fin: 0,
      pal: { 4: 3 },
      nb: { 1: { d: '2026-09-11', f: f({ done: 0 }) }, 2: { d: '2026-09-12', f: f({ done: 1, inc: 2 }) }, 4: { d: '2026-09-13', f: f({ done: 4, wow: 1, tier: 3, pho: 3 }) } } })
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(6500)
  const out = { start: await page.evaluate(() => { const g = window.__capy; const nb = g.notebook(); return { biome: g.biome.current, row: nb.row, arm: nb.arm, err: g.state.lastError || null } }) }
  out.paper = await page.evaluate(() => { const li = document.querySelector('.capyui-trav'); return { visible: !!li && !li.classList.contains('capyui-hidden'), soon: !!li && li.classList.contains('soon'), txt: li ? li.textContent.trim() : '' } })
  await page.screenshot({ path: 'qa/l6-notebook-look-paper.png', timeout: 90000 })
  await page.keyboard.press('KeyJ')
  await page.waitForTimeout(900)
  out.page = await page.evaluate(() => {
    const det = document.querySelector('.capyui-jrnb')
    if (!det) return { det: false }
    det.open = true
    det.scrollIntoView({ block: 'start' })
    const ents = [...det.querySelectorAll('.capyui-nbe')].map(e => ({ d: (e.querySelector('.capyui-nbd') || {}).textContent, t: (e.querySelector('.capyui-nbt') || {}).textContent, blank: !!e.querySelector('.capyui-nbt.blank'), go: e.querySelector('.capyui-nbgo') ? e.querySelector('.capyui-nbgo').tagName + ':' + e.querySelector('.capyui-nbgo').textContent : '' }))
    return { det: true, hidden: det.hidden, sum: (det.querySelector('summary') || {}).textContent, ents, fs: getComputedStyle(det.querySelector('.capyui-nbt') || det).fontSize }
  })
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'qa/l6-notebook-look.png', timeout: 90000 })
  // the button: pins the arrow on them
  await page.evaluate(() => { const b = document.querySelector('button.capyui-nbgo'); if (b) b.click() })
  await page.waitForTimeout(900)
  out.pinned = await page.evaluate(() => { const g = window.__capy; const nb = g.notebook(); const li = document.querySelector('.capyui-trav'); const clue = document.querySelector('.capyui-clue'); return { row: nb.row, arm: nb.arm, aim: !!(li && li.querySelector('.capyui-aim.on')), soon: !!li && li.classList.contains('soon'), clue: clue ? clue.textContent : '', hint: g.hintTarget('traveller'), err: g.state.lastError || null } })
  await page.screenshot({ path: 'qa/l6-notebook-look-pinned.png', timeout: 90000 })
  await page.evaluate(o => fetch('/shot?name=l6-notebook-look.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
