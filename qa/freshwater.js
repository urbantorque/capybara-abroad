async page => {
  // The second unproven thing in the audio pass. The Freshwater is wired as a
  // `diesel` mover at near 14 / far 260, and in the S1b sweep she sat 321 m off
  // for the whole sample — past her own far plane, correctly silent, and so her
  // levels have never once been heard. Two phases:
  //   A. a distance ladder, to see the inverse-distance law actually resolve
  //   B. a flyby from a standing ear, to see pan sweep and Doppler change sign
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)
  await page.evaluate(() => window.__capy.biome.switchTo('quay'))
  await page.waitForTimeout(9000)

  const out = { errs: errs }
  out.biome = await page.evaluate(() => window.__capy.biome.current)

  // ---- A. the ladder ------------------------------------------------------
  out.ladder = []
  for (const d of [300, 240, 160, 100, 60, 30, 14, 8]) {
    await page.evaluate((dd) => {
      const g = window.__capy
      const f = g.quay.freshwater()
      // Stand off along +X of wherever she is right now. Her own y is the deck;
      // put the ear at the waterline so the ladder is a horizontal one.
      g.capy.body.position.set(f.x + dd, f.y, f.z)
      g.capy.body.velocity.set(0, 0, 0)
    }, d)
    await page.waitForTimeout(700)
    const row = await page.evaluate((dd) => {
      const g = window.__capy
      const a = g.hud.moverAudit()
      const r = a.rows.filter(x => x.key === 'quay:freshwater')[0] || null
      return r ? { want: dd, d: +r.d.toFixed(1), gain: +r.gain.toFixed(5),
                   pan: +r.pan.toFixed(3), rate: +r.rate.toFixed(4),
                   live: r.live, bed: r.bed, built: r.built } : { want: dd, missing: true }
    }, d)
    out.ladder.push(row)
  }

  // ---- B. the flyby -------------------------------------------------------
  // Park the ear 30 m off her track, ahead of her, and hold still. This is the
  // only way to see the two things a ladder cannot: the pan crossing zero, and
  // the rate falling through 1.0 as she stops approaching and starts leaving.
  await page.evaluate(() => {
    const g = window.__capy
    const f = g.quay.freshwater()
    g.capy.body.position.set(f.x + 30, f.y, f.z)
    g.capy.body.velocity.set(0, 0, 0)
    window.__f = []
    window.__fi = setInterval(() => {
      const a = g.hud.moverAudit()
      const r = a.rows.filter(x => x.key === 'quay:freshwater')[0]
      if (r) window.__f.push([+g.state.time.toFixed(1), +r.d.toFixed(1),
                              +r.gain.toFixed(5), +r.pan.toFixed(3), +r.rate.toFixed(4)])
    }, 300)
  })
  await page.waitForTimeout(30000)
  out.flyby = await page.evaluate(() => {
    const g = window.__capy
    clearInterval(window.__fi)
    const f = window.__f
    return {
      n: f.length,
      dMin: f.reduce((m, x) => Math.min(m, x[1]), 1e9),
      gMax: f.reduce((m, x) => Math.max(m, x[2]), 0),
      panMin: f.reduce((m, x) => Math.min(m, x[3]), 9),
      panMax: f.reduce((m, x) => Math.max(m, x[3]), -9),
      rateMin: f.reduce((m, x) => Math.min(m, x[4]), 9),
      rateMax: f.reduce((m, x) => Math.max(m, x[4]), 0),
      trace: f.filter((x, i) => i % 3 === 0)
    }
  })

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=freshwater.json', { method: 'POST', body: s })
  }, out)
}
