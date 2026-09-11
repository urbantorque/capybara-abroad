async page => {
  // THE MELODY (L3, F2): the lead's degree walk, sampled in Kyoto (koto) and
  // Sydney (mallet). Among the changes of degree, the share that are a step
  // of one; and the cells played. Before: the degree was a fresh dice roll.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  const out = { rows: [], errs: [] }
  for (const key of ['Digit4', 'Digit1']) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5000)
    await page.keyboard.press(key)
    await page.waitForTimeout(6000)
    const r = await page.evaluate(() => new Promise((res) => {
      const g = window.__capy
      const t0 = performance.now()
      let last = g.musAudit().melDeg, c0 = g.musAudit().melCells
      const deltas = []
      const iv = setInterval(() => {
        const a = g.musAudit()
        if (a.melDeg !== last) { deltas.push(a.melDeg - last); last = a.melDeg }
        if (performance.now() - t0 > 60000) {
          clearInterval(iv)
          const steps = deltas.filter(d => Math.abs(d) === 1).length
          res({ biome: g.biome.current, pal: a.pal, changes: deltas.length, steps, stepShare: deltas.length ? +(steps / deltas.length).toFixed(2) : null,
                cells: a.melCells - c0, deltas: deltas.slice(0, 24), err: g.state.lastError || null })
        }
      }, 50)
    }))
    out.rows.push(r)
  }
  out.errs = errs.slice(0, 10)
  await page.evaluate((o) => fetch('/shot?name=l3-melody.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), out)
}
