async page => {
  // T2f, noEchoPing, the picture with the lens pinned (the resting lens is not deterministic).
  // The animal in the dark passage at (32, -14), the lens at (20, 3.5, 0) looking at the east
  // wall. A wheek on the bus, N ticks by hand, then one raw render to the /shot sink —
  // live and flagged at the same tick. Run in a page already in the cave (ten-t2f-ping-clock.js).
  const NAME = 'ten-t2f-ping-shot'
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
  // two lenses: the east wall from the west, and the rig's own angle (behind, 8 m up, down the passage)
  const LENS = { wall: [18, 4.5, 2, 44, 2, -24], rig: [32, 8, -5, 32, 0, -30] }
  for (const [tag, off, n, ln] of [['wall-live-06', false, 36, 'wall'], ['wall-live-12', false, 72, 'wall'], ['wall-off-12', true, 72, 'wall'],
                                   ['rig-live-09', false, 54, 'rig'], ['rig-off-09', true, 54, 'rig']]) {
    out[tag] = await page.evaluate(async o => {
      const g = window.__capy, THREE = g.THREE, b = g.capy.body, h = g.cave.terrainHeight(32, -14)
      g.state.noEchoPing = o.off
      b.position.set(32, h + 0.6, -14); b.velocity.set(0, 0, 0)
      for (let i = 0; i < 90; i++) { g.tick(1 / 60, false); b.velocity.set(0, 0, 0) }
      g.events.emit('capy:wheek')
      for (let i = 0; i < o.n; i++) g.tick(1 / 60, false)
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280 / 760; g.camera.updateProjectionMatrix()
      const L = o.lens; g.camera.position.set(L[0], h + L[1], L[2])
      g.camera.lookAt(new THREE.Vector3(L[3], h + L[4], L[5]))
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + o.name, { method: 'POST', body: d.split(',')[1] })
      g.state.noEchoPing = false
      return g.cave.ping()
    }, { off, n, lens: LENS[ln], name: NAME + '-' + tag })
  }
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
