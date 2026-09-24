async page => {
  // T2f, noSwiftShape: the crescent and the flicker. Hand clock, raw renders to the sink.
  // (1) the column's sixteen, lens low in the glade looking up the shaft: live / flagged / rung 1.
  // (2) the roost after a wheek under it (the colony up): live / flagged, and the task count.
  // Counts: which meshes draw, and how many of the column were mid-flick over 60 frames.
  const NAME = 'ten-t2f-swift'
  const out = {}
  page.setDefaultNavigationTimeout(120000)
  if (await page.evaluate(() => !(window.__capy && window.__capy.biome.current === 'cave'))) {
    await page.setViewportSize({ width: 1280, height: 760 })
    await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
    await page.goto('http://localhost:5196/'); await page.waitForTimeout(6000)
    await page.evaluate(() => { document.querySelector('.capyui-go').click() }); await page.waitForTimeout(6000)
    for (let i = 0; i < 3; i++) {
      if (await page.evaluate(() => window.__capy.biome.current) === 'cave') break
      await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('cave') }); await page.waitForTimeout(11000)
    }
  }
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  const shots = [
    ['col-live', {}, { at: [10, -40], cam: [12, 2, -38], look: [4, 16, -48], wheek: false }],
    ['col-off', { noSwiftShape: true }, { at: [10, -40], cam: [12, 2, -38], look: [4, 16, -48], wheek: false }],
    ['col-rung1', { perfRung: 1 }, { at: [10, -40], cam: [12, 2, -38], look: [4, 16, -48], wheek: false }],
    ['roost-live', {}, { at: [-26, -122], cam: [-12, 8, -118], look: [-36, 20, -128], wheek: true }],
    ['roost-off', { noSwiftShape: true }, { at: [-26, -122], cam: [-12, 8, -118], look: [-36, 20, -128], wheek: true }],
  ]
  for (const [tag, st, L] of shots) {
    out[tag] = await page.evaluate(async o => {
      const g = window.__capy, THREE = g.THREE, b = g.capy.body, L = o.L
      const keep = { noSwiftShape: g.state.noSwiftShape, perfRung: g.state.perfRung }
      const h = g.cave.terrainHeight(L.at[0], L.at[1])
      const hold = () => { Object.assign(g.state, o.st); b.position.set(L.at[0], h + 0.6, L.at[1]); b.velocity.set(0, 0, 0) }
      hold()
      for (let i = 0; i < 60; i++) { g.tick(1 / 60, false); hold() }
      if (L.wheek) { g.events.emit('capy:wheek'); for (let i = 0; i < 70; i++) { g.tick(1 / 60, false); hold() } }
      let flick = 0, frames = 0
      for (let i = 0; i < 60; i++) { g.tick(1 / 60, false); hold(); flick += g.cave.swiftShape().flick; frames++ }
      const s = g.cave.swiftShape()
      const fl = g.cave.terrainHeight(L.cam[0], L.cam[2])
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280 / 760; g.camera.updateProjectionMatrix()
      g.camera.position.set(L.cam[0], fl + L.cam[1], L.cam[2])
      g.camera.lookAt(new THREE.Vector3(L.look[0], fl + L.look[1], L.look[2]))
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + o.name, { method: 'POST', body: d.split(',')[1] })
      Object.assign(g.state, keep)
      return { on: s.on, old: s.old, roostOld: s.roostOld, flickMean: +(flick / frames).toFixed(2), swiftTask: g.taskDone('swiftlets') }
    }, { L, st, name: NAME + '-' + tag })
  }
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
