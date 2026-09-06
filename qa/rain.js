async page => {
  // A5, the half that has never been observed above zero. The last probe forced
  // odds to 1 and read bed().rain 0.000 in five chapters, and concluded the rain
  // terms were dead. This one samples the whole shower instead of glancing at it
  // once, and uses a SHORT hold: wxEnvelope's rise is 0.22 of the WHOLE hold, so
  // the hold: 90 the last probe passed bought a twenty-second attack that was
  // sampled four seconds in.
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(8000)

  const out = { chapters: {}, errs: errs }

  for (const n of ['sydney', 'kyoto', 'kowloon']) {
    if (n !== 'sydney') {
      await page.evaluate((b) => window.__capy.biome.switchTo(b), n)
      await page.waitForTimeout(9000)
    }
    // Force it, then start sampling immediately — the shower is the experiment.
    await page.evaluate((b) => {
      const g = window.__capy
      const row = g.weather.rowOf(b)
      g.weather.set(b, { rain: { odds: 1, peak: Math.max(row.rain.peak, 0.6),
                                 hold: 14, gap: 1 } })
      window.__r = []
      window.__i = setInterval(() => {
        const a = g.musAudit()
        const w = g.weather.bed()
        window.__r.push({ t: +g.state.time.toFixed(1),
                          rain: +w.rain.toFixed(4),
                          drizzle: +g.weather.drizzle().toFixed(4),
                          skyRain: a.skyRain, skyVel: a.skyVel, skyCut: a.skyCut,
                          cloud: +g.weather.cloud().toFixed(3) })
      }, 250)
    }, n)
    await page.waitForTimeout(20000)
    out.chapters[n] = await page.evaluate(() => {
      const g = window.__capy
      clearInterval(window.__i)
      const r = window.__r
      const pk = (f) => r.reduce((m, x) => Math.max(m, x[f]), 0)
      return {
        biome: g.biome.current, samples: r.length,
        peakRain: pk('rain'), peakDrizzle: pk('drizzle'), peakSkyRain: pk('skyRain'),
        skyVelMin: r.reduce((m, x) => Math.min(m, x.skyVel), 9),
        skyCutMin: r.reduce((m, x) => Math.min(m, x.skyCut), 1e9),
        skyCutMax: pk('skyCut'), peakCloud: pk('cloud'),
        // the shape of the shower, thinned, so a flat zero is distinguishable
        // from a shower that happened and was missed
        trace: r.filter((x, i) => i % 4 === 0).map(x => [x.t, x.rain, x.skyRain])
      }
    })
  }

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=rain.json', { method: 'POST', body: s })
  }, out)
}
