async page => {
  // THE FLOCK, THREE CHAPTERS, TWO CHANNELS.
  //
  //   venice   at/put + scare: a dropped sandwich should pull pigeons in, and
  //            a run through the middle of them should put them up.
  //   manly    at/put + scare + land: the gulls are on a shop parapet, so the
  //            drift is worth nothing unless `land` brings them down first.
  //   goreme   scare only: four hundred rock doves off a cliff, on a RUN, which
  //            has never been a thing that could happen.
  //
  // Both halves are counted rather than looked at (`flockDebug`), because a
  // flock walking toward a chip and a flock that happens to be facing that way
  // are the same screenshot. `puts` is the honest one: it is the number of
  // times this system has written a bird's position.
  const out = {}
  await page.setViewportSize({ width: 1280, height: 760 })

  async function chapter(key) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(9000)
  }

  // ---- venice ------------------------------------------------------------
  await chapter('Digit0')
  out.venice = await page.evaluate(() => {
    const g = window.__capy
    // IN THE PIAZZA, not in front of the animal. The first run of this dropped
    // the sandwich two metres from the spawn — which in chapter 10 is the molo,
    // forty-eight metres from the nearest pigeon — and reported a flock that
    // found its food and never moved. The probe was the experiment again.
    const p = g.venice.piazza
    g.capy.body.position.set(p.x, g.venice.terrainHeight(p.x, p.z) + 0.6, p.z)
    g.capy.body.velocity.set(0, 0, 0)
    g.physics.spawnProp('sandwich', p.x + 2, p.z + 2)
    return { biome: g.biome.current, before: g.flockDebug(true) }
  })
  await page.waitForTimeout(9000)
  out.venice.fed = await page.evaluate(() => window.__capy.flockDebug())
  // ...and then a run straight through the middle of them.
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW')
  await page.waitForTimeout(4000)
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft')
  await page.waitForTimeout(1200)
  out.venice.ran = await page.evaluate(() => {
    const g = window.__capy
    return { flock: g.flockDebug(), err: g.state.lastError || '' }
  })

  // ---- manly -------------------------------------------------------------
  await chapter('BracketRight')
  out.manly = await page.evaluate(() => {
    const g = window.__capy
    const c = g.capy.position
    g.physics.spawnProp('chips', c.x + 1.5, c.z + 1.5)
    return { biome: g.biome.current, before: g.flockDebug(true) }
  })
  await page.waitForTimeout(11000)
  out.manly.fed = await page.evaluate(() => {
    const g = window.__capy
    return { flock: g.flockDebug(), err: g.state.lastError || '' }
  })

  // ---- goreme ------------------------------------------------------------
  await chapter('BracketLeft')
  await page.evaluate(() => {
    const g = window.__capy
    // On the cliff road, at the foot of the dovecotes, standing still.
    g.capy.body.position.set(-70, g.goreme.terrainHeight(-70, -42) + 0.6, -42)
    g.capy.body.velocity.set(0, 0, 0)
    g.flockDebug(true)
  })
  await page.waitForTimeout(2500)
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW')
  await page.waitForTimeout(5000)
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft')
  out.goreme = await page.evaluate(() => {
    const g = window.__capy
    return { biome: g.biome.current, flock: g.flockDebug(),
             speed: +Math.hypot(g.capy.velocity.x, g.capy.velocity.z).toFixed(2),
             err: g.state.lastError || '' }
  })

  await page.evaluate(o => fetch('/shot?name=d7-flock.json',
      { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
