async page => {
  // L4 F4 — THE DEPARTURE AND THE CODA.
  // Part one: a seeded file with Sydney enough (fifteen of nineteen and the
  // marquee), Enter, then hud.travel(2) — the board's own line to Pasto.
  // Sampled every 200 ms for four seconds: the camera's boom (camInfo.dist),
  // the fade element's class, the done card's kicker, the farewell count
  // (state.leaveSaid), bubbles seen. Expected: the boom out to ~16 m, three
  // farewells, a card saying THAT WILL DO HERE, the fade at ~2.4 s, Pasto
  // after it. Frame at 1.5 s: qa/l4dep-look.png.
  // Part two: a finished file (every task, fin: 1) on the Sydney lawn, the
  // keepsakes staged, hud.finaleClose(): codaAudit over twelve seconds —
  // nineteen notes scheduled, the music bus at the floor during the hush,
  // the ledger up after. qa/l4-depart.json
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  const IDS1 = ['wheek', 'steal-hat', 'coffee-spill', 'picnic-thief', 'bin-chicken', 'dig-flower', 'chased', 'photo-op', 'opera-stage', 'ball-harbour', 'swim', 'hat-harbour', 'cafe-table', 'busker-hat', 'dog-loose']
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(3000)
  await page.evaluate((ids) => {
    localStorage.clear()
    localStorage.setItem('capy3.journey.v1', JSON.stringify({ v: 1, tasks: ids, seen: [1], recs: {}, told: 1, ms: 900000, chapms: { 1: 900000 }, finds: [], foundAt: {}, biome: 'sydney', fin: 0 }))
  }, IDS1)
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(3500)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }
  out.enough = await page.evaluate(() => { const c = window.__capy.hud.chapAudit ? window.__capy.hud.chapAudit() : null; return c })
  out.rest = await page.evaluate(() => +window.__capy.camInfo.dist.toFixed(2))
  await page.evaluate(() => {
    const g = window.__capy
    const L = window.__l4d = { t0: performance.now(), rows: [], bubbles: [] }
    const mo = new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) {
      if (n.nodeType === 1 && n.classList && n.classList.contains('capynpc-bubble')) L.bubbles.push(((performance.now() - L.t0) / 1000).toFixed(1) + ' ' + n.textContent.slice(0, 40)) } })
    mo.observe(document.body, { childList: true, subtree: true })
    L.iv = setInterval(() => {
      const fade = document.querySelector('.capyui-fade'), done = document.querySelector('.capyui-done')
      L.rows.push({ t: +((performance.now() - L.t0) / 1000).toFixed(1), dist: +g.camInfo.dist.toFixed(1), shot: +g.camInfo.shot.toFixed(2),
        fade: fade ? fade.className.replace('capyui-fade', '').trim() : '', done: done && done.classList.contains('show') ? (done.querySelector('.capyui-donekick') || {}).textContent : '',
        said: g.state.leaveSaid || 0, biome: g.biome.current, leave: g.hud.leaveAudit().busy })
    }, 200)
    g.hud.travel(2)
  })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/l4dep-look.png', timeout: 90000 })
  await page.waitForTimeout(3700)
  out.depart = await page.evaluate(() => { const L = window.__l4d; clearInterval(L.iv); return { rows: L.rows, bubbles: L.bubbles, biome: window.__capy.biome.current, err: window.__capy.state.lastError || null } })

  // ---- part two: the coda ------------------------------------------------
  const allIds = await page.evaluate(async () => {
    const src = await (await fetch('/src/shared.js', { cache: 'no-store' })).text()
    const i = src.indexOf('export const TASKS'); const j = src.indexOf('\n];', i)
    return [...src.slice(i, j).matchAll(/id: '([a-z0-9-]+)'/g)].map(m => m[1])
  })
  await page.evaluate((ids) => {
    localStorage.clear()
    const seen = []; for (let k = 1; k <= 19; k++) seen.push(k)
    localStorage.setItem('capy3.journey.v1', JSON.stringify({ v: 1, tasks: ids, seen, recs: {}, told: 1, ms: 9000000, chapms: {}, finds: [], foundAt: {}, biome: 'sydney', fin: 0 }))
  }, allIds)
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(4000)
  out.coda = await page.evaluate(() => new Promise(res => {
    const g = window.__capy
    const rows = []
    const t0 = performance.now()
    g.hud.finaleClose()
    const iv = setInterval(() => {
      const a = g.hud.codaAudit()
      const led = document.querySelector('.capyui-led')
      rows.push({ t: +((performance.now() - t0) / 1000).toFixed(1), notes: a.notes, hushed: a.hushed, music: a.music, running: a.running, ledger: !!(led && led.classList.contains('show')), shot: +g.camInfo.shot.toFixed(2), dist: +g.camInfo.dist.toFixed(1) })
      if (rows.length >= 30) { clearInterval(iv); res({ rows, err: g.state.lastError || null }) }
    }, 500)
  }))
  await page.screenshot({ path: 'qa/l4dep-coda.png', timeout: 90000 })
  await page.evaluate((o) => fetch('/shot?name=l4-depart.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
