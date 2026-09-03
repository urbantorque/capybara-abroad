async page => {
  // Is the rush bed actually DRIVEN? A hop cannot answer it: the animal leaves
  // the ground at about 6.3 m/s and the floor is 6.5, which is deliberate — a
  // capybara hopping across a lawn does not whistle. The Drift is where a fall
  // is long enough to get there, and its lower gravity makes the fall longer
  // rather than faster, which is the honest hard case.
  await page.setViewportSize({ width: 1100, height: 660 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit9')
  await page.waitForTimeout(11000)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const s = []
    // walk off the edge of whatever we are standing on
    for (let i = 0; i < 900; i++) {
      // WRITTEN EVERY TICK. systems.js owns input.x/z and rebuilds them from the
      // key state each frame, so a single write before the loop moves nothing —
      // the first run of this probe walked 0.6 m/s and reported the bed dead.
      g.input.z = 1; g.input.run = true
      const v = g.capy.velocity
      const m = g.hud.mixAudit()
      s.push([g.capy.grounded ? 1 : 0,
              Math.round(Math.hypot(v.x, v.y, v.z) * 10) / 10,
              m ? Math.round(m.rush * 1000) / 1000 : null])
      await new Promise(r => setTimeout(r, 12))
    }
    g.input.z = 0; g.input.run = false
    const air = s.filter(r => r[0] === 0)
    return { biome: g.biome.current, samples: s.length, airborne: air.length,
             maxSpeedAir: air.length ? Math.max.apply(null, air.map(r => r[1])) : 0,
             maxRush: Math.max.apply(null, s.map(r => r[2] || 0)),
             fastest: s.slice().sort((a, b) => b[1] - a[1]).slice(0, 5) }
  })
  await page.evaluate((o) => fetch('/shot?name=d9-rush.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
