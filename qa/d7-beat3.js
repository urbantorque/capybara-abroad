async page => {
  const out = { rows: [] }
  await page.setViewportSize({ width: 1280, height: 760 })
  for (const [key, tag] of [['Digit4', 'kyoto'], ['Digit7', 'iceland']]) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(9000)
    const r = await page.evaluate(() => new Promise(res => {
      const g = window.__capy
      const why = Object.create(null)
      let n = 0
      const t = setInterval(() => {
        for (const row of g.beatAudit().rows) {
          const k = row.why || '(free)'
          why[k] = (why[k] || 0) + 1
        }
        if (++n > 60) {
          clearInterval(t)
          res({ biome: g.biome.current, why: why,
                rain: g.weather ? g.weather.rain && g.weather.rain() : null })
        }
      }, 500)
    }))
    r.tag = tag
    out.rows.push(r)
  }
  await page.evaluate(o => fetch('/shot?name=d7-beat3.json',
      { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
