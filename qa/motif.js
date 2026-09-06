async page => {
  // M1. The one thing that would make the arrival phrase worthless is being in
  // the wrong key, and it is built from musCurChord precisely so it cannot be —
  // but "cannot be by construction" is a claim, and this is the measurement.
  // Also: does the second voice enter with chapter progress, and does the sky
  // reach the score at all.
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)

  const out = { palettes: [], errs: errs }

  // ---- the phrase, in every palette in the table ---------------------------
  out.palettes = await page.evaluate(async () => {
    const g = window.__capy
    const rows = []
    for (let n = 0; n < 21; n++) {
      const r = g.hud.phraseAudit(n)
      rows.push({ n: n, pal: r.pal, ok: r.ok, notes: r.notes,
                  chord: r.chord, inst: r.inst, second: r.second })
      await new Promise(res => setTimeout(res, 90))
    }
    // put the harbour back so the sky test below is measured somewhere real
    g.hud.phraseAudit(0)
    return rows
  })

  // ---- the sky, in the chapters whose moods actually have rain in them -----
  out.sky = {}
  for (const n of ["sydney", "pasto", "kowloon", "iceland", "cave"]) {
    // FORCE THE SHOWER. A shower is a dice roll on a 56-to-130 second timer, so
    // a probe that just arrives and looks measures a dry chapter every time and
    // reports the whole rain path as dead. wx-fuzz.js pays for this same lesson.
    await page.evaluate((b) => {
      const g = window.__capy
      if (g.weather && g.weather.rowOf && g.weather.set) {
        const row = g.weather.rowOf(b)
        g.weather.set(b, { rain: { odds: 1, peak: Math.max(row.rain.peak, 0.55),
                                   hold: 90, gap: 3 } })
      }
      g.biome.switchTo(b)
    }, n)
    await page.waitForTimeout(11000)
    out.sky[n] = await page.evaluate(() => {
      const g = window.__capy
      const a = g.musAudit()
      const w = g.weather && g.weather.bed ? g.weather.bed() : null
      return { pal: a.pal, skyRain: a.skyRain, skyCut: a.skyCut, skyVel: a.skyVel,
               bedRain: w ? +w.rain.toFixed(3) : null,
               cloud: g.weather && g.weather.cloud ? +g.weather.cloud().toFixed(3) : null,
               chapProg: a.chapProg, second: a.second }
    })
  }

  out.audit = await page.evaluate(() => window.__capy.musAudit())
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=motif.json', { method: 'POST', body: s })
  }, out)
}
