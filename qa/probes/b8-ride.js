async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = {}
    g.biome.switchTo('pasto')
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
    g.input.x = 0; g.input.z = 0
    const b = g.capy.body
    let car = null
    for (const bd of g.world.bodies) {
      if (bd.type === 4 && bd.shapes.length === 2 && Math.abs(bd.position.x - 10.5) < 0.6) car = bd
    }
    R.hasCar = !!car
    // park well clear of the lane and let her run a full length: does she still move?
    b.position.set(-4, 0.4, 26); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    const z0 = car.position.z
    for (let i = 0; i < 60 * 25; i++) g.tick(1 / 60, false)
    R.clearLaneTravel = +Math.abs(car.position.z - z0).toFixed(2)

    // now ride her: drop the animal onto the deck and hold it there for the run
    const done = () => !!(g.taskDone && g.taskDone('carroza'))
    R.taskBefore = done()
    let rode = 0
    for (let i = 0; i < 60 * 30; i++) {
      b.position.set(car.position.x, 1.55 + 0.34, car.position.z)
      b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.tick(1 / 60, false)
      if (Math.abs(car.velocity.z) > 0.1) rode++
      if (done()) break
    }
    R.rideMovingFrames = rode
    R.taskAfter = done()
    R.tasksKeys = typeof g.taskDone
    R.err = g.state.lastError || null
    return R
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b8-ride.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
