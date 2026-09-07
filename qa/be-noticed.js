async page => {
  // ---------------------------------------------------------------------------
  // qa/be-noticed.js — DOES ANYBODY NOTICE YOU SITTING STILL? (ROADMAP-FUN, 3)
  //
  // MEASURED BEFORE BUILDING: the `photo` state exists and works, and
  // `hasCamera` is set on at most three `kind === 'tourist'` records — a roster
  // that only Sydney has. So the one channel that pays a player for being a
  // calm animal rather than a menace lived in one chapter of nineteen.
  //
  // The locals can now take the picture too. Three things to prove, and the
  // third is the one that would be easy to ship broken:
  //
  //   A. it fires at all, in chapters that are not Sydney
  //   B. it needs the LOAF — a moving capybara is not photographed
  //   C. it is gated on heat: a square you have made cross does not admire you
  //
  // `npc:photo` is the channel; nothing in src listens to it, so it is wrapped
  // on `game.events` here.
  // ---------------------------------------------------------------------------
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)

  async function arm() {
    await page.evaluate(() => {
      const g = window.__capy
      window.__ph = []
      if (!window.__phHooked) {
        window.__phHooked = true
        g.events.on('npc:photo', (r) => {
          window.__ph.push({ t: +g.state.time.toFixed(1),
                             who: r && r.id !== undefined ? String(r.id) : '?' })
        })
      }
      window.__ph.length = 0
    })
  }

  const rows = []
  for (const b of ['venice', 'monaco', 'kowloon', 'goreme']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(10000)
    await arm()
    // A. STAND STILL for twice the loaf gate plus the gesture.
    await page.evaluate(() => new Promise(r => setTimeout(r, 20000)))
    const still = await page.evaluate(() => {
      const g = window.__capy
      return { biome: g.biome.current, n: window.__ph.length,
               restT: +(g.capy.restT || 0).toFixed(1),
               people16: g.peopleNear(g.capy.position.x, g.capy.position.z, 16),
               heat: typeof g.placeHeat === 'function'
                 ? +g.placeHeat(g.capy.position.x, g.capy.position.z).toFixed(2) : -1 }
    })
    // B. MOVING. Twenty seconds of walking must produce none.
    await arm()
    for (let i = 0; i < 10; i++) {
      await page.keyboard.down(i % 2 ? 'KeyW' : 'KeyS')
      await page.waitForTimeout(1900)
      await page.keyboard.up(i % 2 ? 'KeyW' : 'KeyS')
    }
    const moving = await page.evaluate(() => ({
      n: window.__ph.length, restT: +(window.__capy.capy.restT || 0).toFixed(1)
    }))
    // C. HOT. Force the place cross and stand still again.
    await arm()
    await page.evaluate(() => { window.__capy.forceHeat(1) })
    await page.evaluate(() => new Promise(r => setTimeout(r, 20000)))
    const hot = await page.evaluate(() => {
      const g = window.__capy
      const o = { n: window.__ph.length, restT: +(g.capy.restT || 0).toFixed(1),
                  heat: +g.placeHeat(g.capy.position.x, g.capy.position.z).toFixed(2) }
      g.forceHeat(-1)
      return o
    })
    rows.push({ want: b, still: still, moving: moving, hot: hot })
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=be-noticed.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs })
}
