async page => {
  // A PICTURE OF SOMEBODY DOING THEIR JOB.
  //
  // frameShot always looks at the ANIMAL, so to get a person in the frame the
  // animal has to stand just PAST them and the camera has to be put on the
  // other side: yaw is the bearing from the animal toward the person, which
  // puts the person between the lens and the capybara. The first attempt put
  // the animal on top of the barber and photographed a capybara with a pair of
  // legs behind it.
  //
  // Six frames a second apart, because a work stroke is 0.6 s on a 2.4 s clock
  // and most frames are of somebody standing still.
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  const out = { rows: [] }
  for (const [key, tag, sfx] of [['Slash', 'barber', 'tick'],
                                 ['BracketLeft', 'potter', 'thud']]) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(9000)
    for (let i = 0; i < 8; i++) {
      const st = await page.evaluate((o) => {
        const g = window.__capy
        const b = g.beatAudit().rows.filter(r => r.sfx === o.sfx)[0]
        if (!b) return null
        const api = g[g.biome.current]
        const ty = api && api.terrainHeight ? api.terrainHeight : null
        // 2.6 m past them, on the far side from the camera.
        const px = b.x + 2.6, pz = b.z + 2.6
        g.capy.body.position.set(px, (ty ? ty(px, pz) : 0) + 0.5, pz)
        g.capy.body.velocity.set(0, 0, 0)
        g.frameShot({ yaw: Math.atan2(b.x - px, b.z - pz),
                      dist: 5.2, pitch: 0.03, raise: 1.15, hold: 2.0 })
        return { p: b.p, swings: b.swings, why: b.why }
      }, { sfx: sfx })
      await page.waitForTimeout(1000)
      await page.screenshot({ path: 'qa/d7b-' + tag + '-' + (i + 1) + '.png' })
      out.rows.push({ tag: tag, i: i + 1, st: st })
    }
  }
  await page.evaluate(o => fetch('/shot?name=d7-beatshot.json',
      { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
