async page => {
  // T2f, noFern: the doline floor with the lens pinned, ferns live, flagged, and at rung 1
  // (the cones must come back and the ferns go). Raw renders to the /shot sink.
  // Fresh session after any cave.js edit (modules cache across goto).
  const NAME = 'ten-t2f-fern'
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
  // lens: [camera x, y above floor, z, target x, y above floor, z]; the animal at (a, b)
  const LENS = {
    rim: { at: [8, -30], cam: [10, 3.2, -24], look: [4, 0.5, -44] },
    glade: { at: [4, -40], cam: [4, 7.5, -31], look: [4, 0, -50] },
  }
  const shots = [['rim-live', 'rim', {}], ['rim-off', 'rim', { noFern: true }], ['rim-rung1', 'rim', { perfRung: 1 }],
                 ['glade-live', 'glade', {}], ['glade-off', 'glade', { noFern: true }]]
  for (const [tag, ln, st] of shots) {
    out[tag] = await page.evaluate(async o => {
      const g = window.__capy, THREE = g.THREE, b = g.capy.body, L = o.L
      const keep = { noFern: g.state.noFern, perfRung: g.state.perfRung }
      Object.assign(g.state, o.st)
      const h = g.cave.terrainHeight(L.at[0], L.at[1])
      b.position.set(L.at[0], h + 0.6, L.at[1]); b.velocity.set(0, 0, 0)
      for (let i = 0; i < 40; i++) { g.tick(1 / 60, false); b.velocity.set(0, 0, 0) }
      Object.assign(g.state, o.st)       // the governor may have moved the rung in those ticks
      g.tick(1 / 60, false)
      const f = g.cave.fern()
      const fl = g.cave.terrainHeight(L.cam[0], L.cam[2])
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280 / 760; g.camera.updateProjectionMatrix()
      g.camera.position.set(L.cam[0], fl + L.cam[1], L.cam[2])
      g.camera.lookAt(new THREE.Vector3(L.look[0], g.cave.terrainHeight(L.look[0], L.look[2]) + L.look[1], L.look[2]))
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + o.name, { method: 'POST', body: d.split(',')[1] })
      Object.assign(g.state, keep)
      return f
    }, { L: LENS[ln], st, name: NAME + '-' + tag })
  }
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
