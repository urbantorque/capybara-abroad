async page => {
  const TAG = 'before'
  const STATIONS = [
    { name: 'quay-crowd', key: 'Digit3', at: null },
    { name: 'souk-crowd', key: 'Digit8', at: null },
    { name: 'mongkok', key: 'Minus', at: null },
    { name: 'sydney-forecourt', key: 'Digit1', at: [0, 30] }
  ]
  await page.setViewportSize({ width: 1280, height: 720 })
  const out = []

  for (const st of STATIONS) {
    try {
      await page.goto('http://localhost:5188/')
      await page.waitForTimeout(5200)
      await page.keyboard.press(st.key)
      await page.waitForTimeout(4200)
      if (st.at) {
        await page.evaluate((a) => {
          const g = window.__capy
          g.capy.body.position.set(a[0], g.capy.position.y + 1.2, a[1])
          g.capy.body.velocity.set(0, 0, 0)
        }, st.at)
        await page.waitForTimeout(2500)
      }
      await page.waitForTimeout(5000)

      await page.evaluate(() => {
        window.__c = { n: 0, sum: 0, min: 1, low: 0, dips: 0, was: 1 }
        window.__ci = setInterval(() => {
          const g = window.__capy
          if (!g || !g.camInfo) return
          const c = g.camInfo.clear
          const s = window.__c
          s.n++; s.sum += c
          if (c < s.min) s.min = c
          if (c < 0.95) s.low++
          if (c < 0.95 && s.was >= 0.95) s.dips++
          s.was = c
        }, 16)
      })
      await page.waitForTimeout(25000)
      const row = await page.evaluate(() => {
        clearInterval(window.__ci)
        const s = window.__c
        const g = window.__capy
        let people = 0
        try {
          for (const b of g.world.bodies) {
            if (b.userData && (b.userData.npc || b.userData.local)) people++
          }
        } catch (e) { people = -1 }
        return { biome: g.biome.current, n: s.n, mean: s.n ? s.sum / s.n : 1,
                 min: s.min, lowFrac: s.n ? s.low / s.n : 0, dips: s.dips,
                 people: people, bodies: g.world.bodies.length,
                 pos: [g.capy.position.x, g.capy.position.z] }
      })
      await page.screenshot({ path: 'qa/p1-crowd-' + TAG + '-' + st.name + '.png' })
      out.push(Object.assign({ st: st.name }, row))
    } catch (err) {
      out.push({ st: st.name, error: String(err && err.message || err) })
    }
  }

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: s })
  }, { tag: 'p1-crowd-' + TAG, rows: out })
}
