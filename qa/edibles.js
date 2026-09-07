async page => {
  // ---------------------------------------------------------------------------
  // qa/edibles.js — WHICH CHAPTERS HAVE ANYTHING TO EAT? (ROADMAP-FUN, item 3)
  //
  // The item says the snack "makes `graze` reachable in the eleven chapters
  // with no edible prop (6 of 17 measured in the mischief-radii memory)" —
  // which is two different numbers in one sentence, and neither can be checked
  // from the source alone: ten `physTYPES` carry `edible: true`, but what
  // matters is how many of them a given chapter actually BUILDS.
  //
  // Counts the live world, per chapter, filtered on `q.biome === live` because
  // `game.props` accumulates (B5).
  // ---------------------------------------------------------------------------
  const ORDER = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit0')
  await page.waitForTimeout(7000)

  // The edible types, off the source, so the list cannot go stale here.
  const src = await page.evaluate(() => fetch('/src/props.js').then(r => r.text()))
  const ED = new Set()
  for (const m of src.matchAll(/^\s{2}([a-z]+):\s+\{[^\n]*edible: true/gm)) ED.add(m[1])

  const rows = []
  for (const b of ORDER) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(11000)
    const r = await page.evaluate((arg) => {
      const g = window.__capy
      const live = g.biome.current
      const by = {}
      let n = 0
      for (const q of (g.props || [])) {
        if (!q || q.biome !== live || !q.body || !q.body.world) continue
        if (!arg.ed.includes(q.type)) continue
        by[q.type] = (by[q.type] || 0) + 1
        n++
      }
      return { biome: live, want: arg.b, n: n, types: by }
    }, { b: b, ed: [...ED] })
    rows.push(r)
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=edibles.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs, edibleTypes: [...ED] })
}
