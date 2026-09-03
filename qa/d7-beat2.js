async page => {
  // WHY IS KYOTO FOUR AND HANOI TWENTY-SIX?
  //
  // The 45 s sweep gave a swing count per chapter with a spread of 2..26, and a
  // low count has two completely different causes that look identical from
  // outside: a long clock (waiting) and rule 1 (suppressed — the person is
  // talking, flinching, guarding, fetching, holding an umbrella or walking).
  // `t` is the countdown and `busy` is the flag, sampled at 2 Hz for a minute.
  const out = { rows: [] }
  await page.setViewportSize({ width: 1280, height: 760 })
  for (const [key, tag] of [['Digit4', 'kyoto'], ['Slash', 'hanoi'], ['Digit7', 'iceland']]) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(9000)
    await page.evaluate(() => window.__capy.beatAudit(true))
    const r = await page.evaluate(() => new Promise(res => {
      const g = window.__capy
      let n = 0, busy = 0, samples = 0, tsum = 0
      const t = setInterval(() => {
        const b = g.beatAudit()
        for (const row of b.rows) { samples++; if (row.busy) busy++; tsum += row.t }
        if (++n > 120) {
          clearInterval(t)
          const f = g.beatAudit()
          res({ biome: b.biome, rows: f.rows,
                busyFrac: +(busy / Math.max(1, samples)).toFixed(3),
                meanT: +(tsum / Math.max(1, samples)).toFixed(2),
                swings: f.rows.reduce((a, x) => a + x.swings, 0) })
        }
      }, 500)
    }))
    r.tag = tag
    out.rows.push(r)
  }
  await page.evaluate(o => fetch('/shot?name=d7-beat2.json',
      { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
