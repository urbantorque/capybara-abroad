async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(3000)

  // Tally every sound Sydney makes, ATTRIBUTED to the call site that made it —
  // a count alone cannot tell a busker from a sprinkler. (harness note 16)
  await page.evaluate(() => {
    const g = window.__capy
    window.__tally = {}
    const raw = g.sfx
    g.sfx = function (name, opts) {
      let src = 'unknown'
      try {
        const st = new Error().stack.split('\n')
        for (let i = 2; i < st.length && i < 7; i++) {
          const m = st[i].match(/\/src\/([a-z]+)\.js:(\d+)/)
          if (m) { src = m[1] + ':' + m[2]; break }
        }
      } catch (e) { /* stack shape varies */ }
      const k = name + '  @' + src + (opts && typeof opts.volume === 'number'
        ? '  vol~' + opts.volume.toFixed(2) : '')
      window.__tally[k] = (window.__tally[k] || 0) + 1
      return raw.call(g, name, opts)
    }
  })
  await page.waitForTimeout(90000)
  const tally = await page.evaluate(() => {
    const t = window.__tally || {}
    const rows = Object.keys(t).map(k => [k, t[k]]).sort((a, b) => b[1] - a[1])
    return { perMin: rows.map(r => r[0] + '  x' + r[1]),
             total: rows.reduce((s, r) => s + r[1], 0) }
  })

  await page.evaluate(o => fetch('/shot?name=audio.json', {
    method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1))))
  }), tally)
}
