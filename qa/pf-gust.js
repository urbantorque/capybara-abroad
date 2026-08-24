// PAYOFF batch 1, job 2: DOES A GUST BLOW A LIGHT PROP ACROSS A SQUARE, AND
// DOES IT LEAVE EVERYTHING ELSE ALONE?
//
// Two halves, because either alone is a different bug:
//   THE INTENT   in the four squall chapters, a light prop must actually travel
//                over a long gust — metres, not millimetres.
//   THE PROMISE  in the nine calm chapters NOTHING may stir, no prop may leave
//                physGUST_ROAM of its home however long you wait, and a thrown
//                prop must be untouched by the cap (drag still sheds its speed).
//
// Every number here is real wall-clock seconds of a real weather curve; the
// gust is never held at a fixed value, because a held gust is not what the game
// has and the whole point of the cliff analysis was that a held gust lies.
async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const out = { chapters: {}, issues: [] }
  const names = ['manly', 'sahara', 'iceland', 'antarctic', 'drift',
                 'sydney', 'kyoto', 'venice', 'cave', 'palawan']
  for (const n of names) {
    out.chapters[n] = await page.evaluate(async (name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
      const live = g.biome.current
      // NOT in the water. A floating prop is carried by physBUOY_DRIFT and
      // physFlowAt, which are a current and not the wind: measured before this
      // filter, Sydney's props 'moved' 30 m in a chapter whose effective wind
      // never once reaches the kick threshold.
      const light = g.props.filter(p => !p.removed && !p.hidden && !p.held && !p.keep &&
        !p.inWater && (!p.biome || p.biome === live) && p.mass > 0 && p.mass <= 0.6)
      if (!light.length) return { light: 0 }
      const start = light.map(p => [p.body.position.x, p.body.position.z])
      let wMax = 0, wSum = 0, n = 0
      // 40 s of the chapter's own weather, not a held value
      for (let i = 0; i < 60 * 40; i++) {
        g.tick(1 / 60, false)
        if (i % 6 === 0) {
          // the EFFECTIVE wind the solver sees, not the raw gust: physWindNow
          // takes physGUST_MIN (2.8) off the SPEED and scales the excess by
          // physGUST_K (1.2), so the raw number is about twice the real one.
          const wg = g.weather && g.weather.gust ? g.weather.gust() : { x: 0, z: 0 }
          const raw = Math.hypot(wg.x || 0, wg.z || 0)
          const s = raw > 2.8 ? (raw - 2.8) * 1.2 : 0
          wMax = Math.max(wMax, s); wSum += s; n++
        }
      }
      let moved = 0, roam = 0
      let stillDry = 0
      for (let i = 0; i < light.length; i++) {
        const p = light[i]
        if (p.inWater) continue
        stillDry++
        moved = Math.max(moved, Math.hypot(p.body.position.x - start[i][0],
                                           p.body.position.z - start[i][1]))
        roam = Math.max(roam, Math.hypot(p.body.position.x - p.homeX,
                                         p.body.position.z - p.homeZ))
      }
      return { light: light.length, dry: stillDry, moved: +moved.toFixed(2), roam: +roam.toFixed(2),
               gustMax: +wMax.toFixed(2), gustMean: +(wSum / Math.max(1, n)).toFixed(2) }
    }, n)
  }

  // ---- THE THROW. The cap must not touch a prop the player launched. -------
  out.throw = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('manly')
    const sp = g.biome.spawnOf('manly'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const live = g.biome.current
    const p = g.props.find(q => !q.removed && !q.hidden && !q.held && !q.keep &&
      (!q.biome || q.biome === live) && q.mass > 0 && q.mass <= 0.6)
    if (!p) return { note: 'no light prop in manly' }
    const c = g.capy.position
    p.body.wakeUp()
    p.body.position.set(c.x, c.y + 1.4, c.z)
    p.body.velocity.set(9, 3, 0)                 // a hard throw, 9 m/s downrange
    const trace = []
    for (let i = 0; i < 60 * 3; i++) {
      g.tick(1 / 60, false)
      if (i % 10 === 0) trace.push(+Math.hypot(p.body.velocity.x, p.body.velocity.z).toFixed(2))
    }
    return { v0: 9, trace, flew: +Math.hypot(p.body.position.x - c.x, p.body.position.z - c.z).toFixed(2) }
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=pfgust.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
