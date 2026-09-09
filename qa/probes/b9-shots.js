async page => {
  // ---------------------------------------------------------------------------
  // qa/b9-shots.js — LOOK AT THE FIVE NEW SPILLS AND THE THIRD SHARD
  //
  // Five new spill decals and a new shard material are drawn geometry, and this
  // repository's rule is that drawn geometry is judged from a rendered PNG and
  // not from a count. Everything is spawned in a line in front of the camera in
  // one chapter so the whole set is in one frame.
  // ---------------------------------------------------------------------------
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(11000)

  const laid = await page.evaluate(() => {
    const g = window.__capy
    const cp = g.capy.position
    const TYPES = ['chips', 'handbag', 'flowers', 'plantain', 'maiz']
    const made = []
    for (let i = 0; i < TYPES.length; i++) {
      const x = cp.x + (i - 2) * 1.5, z = cp.z + 4
      const pr = g.physics.spawnProp(TYPES[i], x, z, cp.y + 0.2)
      if (!pr) { made.push(TYPES[i] + ':NONE'); continue }
      pr.disturbed = true
      g.physics.spill(pr)
      made.push(TYPES[i] + ':' + (pr.spilled ? 'spilt' : 'NOT'))
    }
    // ...and one of each shard material, thrown in place.
    g.physics.scatterShards(cp.x - 3, cp.y + 0.6, cp.z + 1.6, 6, 0)
    g.physics.scatterShards(cp.x, cp.y + 0.6, cp.z + 1.6, 6, 1)
    g.physics.scatterShards(cp.x + 3, cp.y + 0.6, cp.z + 1.6, 6, 2)
    return made
  })
  await page.waitForTimeout(1200)
  // Look down the line from just above the animal.
  await page.evaluate(() => {
    const g = window.__capy
    const cp = g.capy.position
    if (typeof g.frameShot === 'function') {
      // frameShot takes ONE options object — yaw/dist/pitch/raise/hold — and
      // frames the animal, so the line of spills is put in front of it and the
      // camera looks down the +z axis at it.
      g.frameShot({ yaw: Math.PI, dist: 6.5, pitch: 0.62, raise: 0.6, hold: 9 })
    }
  })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'qa/B9-spills.png' })
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=b9-shots.json', { method: 'POST', body: s })
  }, { laid: laid, errs: errs })
}
