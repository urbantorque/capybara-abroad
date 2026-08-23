async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('antarctic')
  })
  await page.waitForTimeout(1500)
  // stand at the tiller
  await page.evaluate(() => {
    const g = window.__capy, a = g.antarctic
    const h = a.boat.helm
    g.capy.body.position.set(h.x, h.y + 0.2, h.z)
    g.capy.body.velocity.set(0, 0, 0)
  })
  await page.waitForTimeout(1200)
  const before = await page.evaluate(() => {
    const g = window.__capy, a = g.antarctic
    return { atHelm: a.atHelm(), capy: [+g.capy.position.x.toFixed(2), +g.capy.position.y.toFixed(2), +g.capy.position.z.toFixed(2)],
             helm: [+a.boat.helm.x.toFixed(2), +a.boat.helm.y.toFixed(2), +a.boat.helm.z.toFixed(2)],
             boat: [+a.boat.position.x.toFixed(1), +a.boat.position.z.toFixed(1)] }
  })
  await page.keyboard.press('e')
  await page.waitForTimeout(500)
  const took = await page.evaluate(() => {
    const g = window.__capy, a = g.antarctic
    return { atHelm: a.atHelm(), sailing: g.state.sailing, inputZ: g.input.z, inputX: g.input.x }
  })
  const samples = []
  await page.keyboard.down('w')
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(1000)
    samples.push(await page.evaluate(() => {
      const g = window.__capy, a = g.antarctic
      return { z: +a.boat.position.z.toFixed(1), x: +a.boat.position.x.toFixed(1),
               sp: +a.boat.speed.toFixed(2), pack: +a.pack().toFixed(2), iz: g.input.z }
    }))
  }
  await page.keyboard.up('w')
  // now steer for the lead and run north for 25 s, sampling
  const run = []
  await page.keyboard.down('w')
  for (let i = 0; i < 25; i++) {
    await page.evaluate(() => {
      // hold the tender toward the open water, the way a player would by eye
      const g = window.__capy, a = g.antarctic
      const z = a.boat.position.z
      let best = 0, bd = 1e9
      for (let x = -160; x <= 160; x += 4) { const d = a.packAt(x, z - 60); if (d < bd) { bd = d; best = x } }
      window.__want = best
    })
    const want = await page.evaluate(() => window.__want)
    const cur = await page.evaluate(() => ({ x: window.__capy.antarctic.boat.position.x,
                                             h: window.__capy.antarctic.boat.heading }))
    // heading 0 is +z; north is PI. steer by comparing x error
    const err = want - cur.x
    const key = err > 6 ? 'a' : err < -6 ? 'd' : null
    if (key) { await page.keyboard.down(key); await page.waitForTimeout(220); await page.keyboard.up(key) }
    await page.waitForTimeout(800)
    run.push(await page.evaluate(() => {
      const a = window.__capy.antarctic
      return [+a.boat.position.x.toFixed(0), +a.boat.position.z.toFixed(0),
              +a.boat.speed.toFixed(1), +a.pack().toFixed(2)]
    }))
  }
  await page.keyboard.up('w')
  const after = await page.evaluate(() => {
    const g = window.__capy, a = g.antarctic
    return { boat: [+a.boat.position.x.toFixed(1), +a.boat.position.z.toFixed(1)],
             tasks: g.hud.tasksDone ? g.hud.tasksDone() : -1,
             lead: g.hud.isTaskDone('the-lead'), tiller: g.hud.isTaskDone('take-tiller'),
             err: g.state.lastError || null, saves: g.state.solverSaves || 0,
             capyOnBoat: a.inZone('deck', g.capy.position.x, g.capy.position.z) }
  })
  // call the pod
  await page.keyboard.press('q')
  await page.waitForTimeout(600)
  const called = await page.evaluate(() => {
    const a = window.__capy.antarctic
    const q = a.pod()
    return { withPod: +a.withPod().toFixed(2), pod: [+q.x.toFixed(0), +q.z.toFixed(0)],
             boat: [+window.__capy.antarctic.boat.position.x.toFixed(0), +window.__capy.antarctic.boat.position.z.toFixed(0)] }
  })
  await page.keyboard.down('w')
  const podRun = []
  for (let i = 0; i < 18; i++) {
    await page.waitForTimeout(1000)
    podRun.push(await page.evaluate(() => {
      const a = window.__capy.antarctic
      return [+a.withPod().toFixed(2), +a.boat.speed.toFixed(1), +a.boat.position.z.toFixed(0)]
    }))
  }
  await page.keyboard.up('w')
  const podEnd = await page.evaluate(() => {
    const g = window.__capy
    return { ride: g.hud.isTaskDone('orca-ride'), seenPod: g.antarctic.seenPod(),
             err: g.state.lastError || null,
             recs: (function () { try { return JSON.parse(localStorage.getItem('capy3.journey.v1') || '{}').records || null } catch (e) { return null } })() }
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=antboat.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, { before, took, samples, run, after, called, podRun, podEnd })
}
