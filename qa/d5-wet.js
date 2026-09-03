async page => {
  // D5, THE RAIN HALF: the contact rings, and the smear a wet floor puts
  // under a sign.
  //
  // Both need a downpour, and a downpour is a dice roll the weather table
  // makes about once a minute, so both are forced through `weather.set`.
  //
  //   RINGS. A picture of the ground three metres in front of the animal in
  //   the rain, and the same frame with the pool emptied — which is done by
  //   turning the shower off and letting the last ring die, because there is
  //   no switch for the rings alone and inventing one would be inventing a
  //   second way for them to be wrong.
  //
  //   THE SMEAR. Mong Kok, at a sign, dry and then soaked. `uWetK` is
  //   `shine()` — wetness ABOVE the chapter's own baseline — so Kowloon's
  //   permanently damp asphalt reads ZERO at rest by design, and the
  //   anisotropy only arrives with the shower. The A/B is therefore the
  //   shower itself.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1100, height: 660 })
  const out = { errs: [] }

  await page.goto('http://localhost:5188/')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)

  out.wet = await page.evaluate(async () => {
    const g = window.__capy
    async function shoot(name) {
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + name, { method: 'POST', body: d.split(',')[1] })
    }
    function grab() {
      const c = g.renderer.domElement
      const t = document.createElement('canvas')
      t.width = c.width; t.height = c.height
      t.getContext('2d').drawImage(c, 0, 0)
      return t.getContext('2d').getImageData(0, 0, t.width, t.height).data
    }
    function diff(A, B) {
      let n = 0, s = 0
      for (let i = 0; i < A.length; i += 4) {
        const d = (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) +
                   Math.abs(A[i + 2] - B[i + 2])) / 3
        if (d > 2) { n++; s += d }
      }
      return { pct: +(100 * n / (A.length / 4)).toFixed(2),
               mean: +(s / Math.max(n, 1)).toFixed(1) }
    }
    const rows = []
    for (const n of ['kowloon', 'kyoto']) {
      g.biome.switchTo(n)
      for (let i = 0; i < 600; i++) g.tick(1 / 60, false)
      g.tick(1 / 60, true); const dry = grab(); await shoot('d5-wet-' + n + '-dry')
      const dryShine = +g.weather.shine().toFixed(3)
      const dryRings = g.weather.ringAudit().alive
      g.weather.set(n, { rain: { odds: 1, peak: 1, hold: 60, gap: 0.2 } })
      // Half a minute: `wet` climbs on wxWET_RISE (about twelve seconds to
      // soak) and the shower's own envelope needs about as long again, so a
      // probe that samples at ten seconds measures a damp street and calls
      // the smear weak.
      for (let i = 0; i < 60 * 30; i++) g.tick(1 / 60, false)
      g.tick(1 / 60, true); const wet = grab(); await shoot('d5-wet-' + n + '-wet')
      const d = diff(dry, wet)
      rows.push({ biome: g.biome.current,
                  dryShine: dryShine, wetShine: +g.weather.shine().toFixed(3),
                  wetness: +g.weather.wetness().toFixed(3),
                  rainT: +g.weather.drizzle().toFixed(3),
                  dryRings: dryRings, wetRings: g.weather.ringAudit().alive,
                  ringBorn: g.weather.ringAudit().born,
                  pct: d.pct, mean: d.mean })
    }
    return rows
  })

  out.errs = errs
  await page.evaluate((o) => fetch('/shot?name=d5-wet.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
