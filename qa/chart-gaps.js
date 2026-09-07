async page => {
  // ---------------------------------------------------------------------------
  // qa/chart-gaps.js — WHAT THE CHART DOES NOT MARK (ROADMAP-FUN, item 1e)
  //
  // The headline says "the chart marks landmarks (`sysMARKS`) but not the
  // marquee". `sysMARKS` is the TITLE PICKER's postcards; the chart is
  // `sysMAP_WORLDS[biome].marks`, and thirty-one of its entries are already
  // stars, several standing exactly where a marquee stands. Two of this
  // roadmap's premises have already turned out to be wrong on measurement, so
  // measure this one before building anything:
  //
  //   marqD   metres from the marquee to the nearest existing chart mark
  //   minis   every `mini` row of the chapter, its hint target, and the
  //           distance to the nearest chart mark
  //
  // A mini whose nearest mark is 4 m away is already on the chart under another
  // name. One whose nearest mark is 90 m away is the gap item 1e is about.
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

  // The mini rows, off the source rather than a hand-kept list — `qa/run.mjs`
  // has no way to keep a copy of TASKS honest and `run-code` cannot import.
  const src = await page.evaluate(() => fetch('/src/shared.js').then(r => r.text()))
  const MINIS = {}
  {
    const ti = src.indexOf('export const TASKS')
    const ci = src.indexOf('export const CHAPTERS')
    const recs = src.slice(ti, ci).split(/\n  \{ id: /).slice(1)
    for (const r of recs) {
      const cut = r.indexOf('\n  { id: ')
      const body = r.slice(0, cut >= 0 ? cut : r.length)
      if (!/mini: '/.test(body)) continue
      const id = (body.match(/^'([a-z0-9-]+)'/) || [])[1]
      const ch = +(body.match(/chapter: (\d+)/) || [])[1]
      if (!MINIS[ch]) MINIS[ch] = []
      MINIS[ch].push(id)
    }
  }

  const rows = []
  for (const b of ORDER) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(6000)
    const r = await page.evaluate((arg) => {
      const g = window.__capy
      const a = g.hud.mapMarkAudit()
      const pts = a.pts || []
      function nearest(p) {
        if (!p || !pts.length) return null
        let best = Infinity, who = ''
        for (const q of pts) {
          const d = Math.hypot(q.x - p.x, q.z - p.z)
          if (d < best) { best = d; who = q.t }
        }
        return { d: +best.toFixed(1), t: who }
      }
      const m = g.marqueePoint()
      const minis = []
      for (const id of arg.minis) {
        const t = g.hintTarget(id)
        minis.push({ id: id, has: !!t, near: t ? nearest(t) : null })
      }
      return {
        biome: g.biome.current, want: arg.b,
        marks: pts.length, missing: a.missing,
        marqNear: m ? nearest(m) : null,
        minis: minis
      }
    }, { b: b, minis: MINIS[ORDER.indexOf(b) + 1] || [] })
    rows.push(r)
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=chart-gaps.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs })
}
