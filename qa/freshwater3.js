async page => {
  // Phase C, second attempt. The first derived her heading from a 1.5 s sample
  // taken while she was DWELLING at a wharf — speed 0, so the fallback bearing
  // was used and the ear was parked 150 m up a track she was never on. She is on
  // a route with stops; the heading is only meaningful while she is underway.
  // So: poll until she is actually moving, THEN park ahead of her.
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)
  await page.evaluate(() => window.__capy.biome.switchTo('quay'))
  await page.waitForTimeout(9000)

  const out = { errs: errs }

  out.head = await page.evaluate(() => {
    const g = window.__capy
    return new Promise(res => {
      let last = null, tries = 0
      const iv = setInterval(() => {
        const p = g.quay.freshwater()
        const now = { x: p.x, z: p.z }
        if (last) {
          const dx = now.x - last.x, dz = now.z - last.z
          const L = Math.hypot(dx, dz)
          const spd = L / 0.5
          // Underway, not just drifting on the swell.
          if (spd > 2.0 || ++tries > 90) {
            clearInterval(iv)
            const ux = L > 0.001 ? dx / L : 1, uz = L > 0.001 ? dz / L : 0
            // 200 m up her track and 14 m to one side: far enough that the
            // approach is a long one, close enough that she comes inside the
            // 14 m near plane's neighbourhood as she passes.
            const px = now.x + ux * 200 - uz * 14
            const pz = now.z + uz * 200 + ux * 14
            g.capy.body.position.set(px, p.y, pz)
            g.capy.body.velocity.set(0, 0, 0)
            res({ speed: +spd.toFixed(2), tries: tries,
                  u: [+ux.toFixed(3), +uz.toFixed(3)],
                  park: [+px.toFixed(1), +pz.toFixed(1)] })
            return
          }
        }
        last = now
      }, 500)
    })
  })

  await page.evaluate(() => {
    const g = window.__capy
    window.__f = []
    window.__fi = setInterval(() => {
      const a = g.hud.moverAudit()
      const r = a.rows.filter(x => x.key === 'quay:freshwater')[0]
      if (r) window.__f.push([+g.state.time.toFixed(1), +r.d.toFixed(1),
                              +r.gain.toFixed(5), +r.pan.toFixed(3), +r.rate.toFixed(4)])
    }, 300)
  })
  await page.waitForTimeout(60000)
  out.flyby = await page.evaluate(() => {
    const g = window.__capy
    clearInterval(window.__fi)
    const f = window.__f
    // Only rungs where she can actually be heard say anything about the mix.
    const aud = f.filter(x => x[2] > 0)
    return {
      n: f.length, audible: aud.length,
      dMin: f.reduce((m, x) => Math.min(m, x[1]), 1e9),
      dMax: f.reduce((m, x) => Math.max(m, x[1]), 0),
      gMax: f.reduce((m, x) => Math.max(m, x[2]), 0),
      panAudMin: aud.reduce((m, x) => Math.min(m, x[3]), 9),
      panAudMax: aud.reduce((m, x) => Math.max(m, x[3]), -9),
      rateAudMin: aud.reduce((m, x) => Math.min(m, x[4]), 9),
      rateAudMax: aud.reduce((m, x) => Math.max(m, x[4]), 0),
      rateMin: f.reduce((m, x) => Math.min(m, x[4]), 9),
      rateMax: f.reduce((m, x) => Math.max(m, x[4]), 0),
      trace: f.filter((x, i) => i % 2 === 0)
    }
  })

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=freshwater3.json', { method: 'POST', body: s })
  }, out)
}
