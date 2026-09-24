async page => {
  // T3c: the photo flash (noFlashStar) and the answer to 'finale:staged'
  // (noTravArc) on the Sydney lawn, hand clock, rung pinned at 0.
  // (1) A flash 6 m in front of the lens: drawn as a star, its size, gone
  //     inside 0.1 s; nothing fired at rung 1. A raw render to the sink.
  // (2) 'finale:staged' as systems.js emits it (x, z, r, mouth — the mouth
  //     from the Sydney spawn, as sysFinaleStage works it out). The animal
  //     sits at the middle; the traveller's states in order, the set-down in
  //     the mouth, 'npc:travBag' once, home outside the lens's cone; every
  //     gatherer's slot and final spot outside 5.5 m and outside the cone.
  //     Renders from the coda's own bearing at the set-down and at the end.
  const NAME = 'ten-t3c-finale'
  const PORT = 5193
  const out = {}
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:' + PORT + '/'); await page.waitForTimeout(7000)
  await page.evaluate(() => [...document.querySelectorAll('.capyui-go')].find(b => !b.classList.contains('alt')).click())
  await page.waitForTimeout(9000)
  const shot = async (name, cam, look) => page.evaluate(async o => {
    const g = window.__capy, THREE = g.THREE
    g.renderer.setSize(1280, 720, false)
    g.camera.aspect = 1280 / 720; g.camera.updateProjectionMatrix()
    if (o.cam) {
      g.camera.position.set(o.cam[0], o.cam[1], o.cam[2])
      g.camera.lookAt(new THREE.Vector3(o.look[0], o.look[1], o.look[2]))
      g.camera.updateMatrixWorld(true)
    }
    g.renderer.render(g.scene, g.camera)
    const d = g.renderer.domElement.toDataURL('image/png')
    await fetch('/shot?name=' + o.name, { method: 'POST', body: d.split(',')[1] })
  }, { name: NAME + '-' + name, cam, look })

  // ---- (1) the flash --------------------------------------------------------
  out.flash = await page.evaluate(() => {
    const g = window.__capy, THREE = g.THREE
    g.state.perfRung = 0
    const f = new THREE.Vector3(); g.camera.getWorldDirection(f)
    const p = g.camera.position.clone().addScaledVector(f, 6)
    p.y -= 0.6; p.x += 0.8   // off the lens's axis, beside the animal rather than on it
    const a0 = g.flashAudit()
    g.flashAt(p.x, p.y, p.z)
    g.tick(1 / 60, false)
    const a1 = g.flashAudit()
    window.__t3cFlash = [p.x, p.y, p.z]
    return { before: a0, fired: a1 }
  })
  // fired and drawn in ONE evaluate: the page's own frames run between two
  // calls, and 90 ms is gone before the second one starts
  out.flashShot = await page.evaluate(async o => {
    const g = window.__capy; g.state.perfRung = 0
    const p = window.__t3cFlash
    g.renderer.setSize(1280, 720, false)
    g.camera.aspect = 1280 / 720; g.camera.updateProjectionMatrix()
    g.flashAt(p[0], p[1], p[2])
    const a = g.flashAudit()
    g.renderer.render(g.scene, g.camera)
    const d = g.renderer.domElement.toDataURL('image/png')
    await fetch('/shot?name=' + o.name, { method: 'POST', body: d.split(',')[1] })
    return a
  }, { name: NAME + '-flash' })
  out.flashLater = await page.evaluate(() => {
    const g = window.__capy
    for (let i = 0; i < 6; i++) { g.state.perfRung = 0; g.tick(1 / 60, false) }
    const gone = g.flashAudit()
    g.state.perfRung = 1
    const p = window.__t3cFlash
    g.flashAt(p[0], p[1], p[2])
    const r1 = g.flashAudit()
    g.state.perfRung = 0
    return { after100ms: gone, atRung1: r1 }
  })

  // ---- (2) the finale -------------------------------------------------------
  out.stage = await page.evaluate(() => {
    const g = window.__capy
    window.__t3cBag = []
    g.events.on('npc:travBag', e => window.__t3cBag.push((e && e.npc) || e))
    const sp = g.biome.spawnOf('sydney')
    const X = 30, Z = 26
    const mouth = Math.atan2(sp.z - Z, sp.x - X)
    window.__t3cFin = { X, Z, mouth }
    g.state.perfRung = 0
    g.state.finaleOn = true
    g.events.emit('finale:staged', { x: X, z: Z, r: 2.6, mouth })
    g.tick(1 / 30, false)
    return { mouth: +mouth.toFixed(3), at: g.travFinAt(), gather: g.gatherAudit() }
  })
  out.states = []
  out.samples = []
  let handShot = false
  for (let c = 0; c < 12; c++) {
    const r = await page.evaluate(() => {
      const g = window.__capy, F = window.__t3cFin, b = g.capy.body
      const h = typeof g.env.terrainHeight === "function" ? g.env.terrainHeight(F.X, F.Z) : 0
      const res = { states: [], samples: [], hand: null }
      for (let i = 0; i < 120; i++) {
        g.state.perfRung = 0
        if (i % 20 === 0) { b.position.set(F.X, h + 0.5, F.Z); b.velocity.set(0, 0, 0) }
        g.tick(1 / 30, false)
        const a = g.travFinAt()
        if (!a) continue
        if (!res.states.length || res.states[res.states.length - 1] !== a.st) res.states.push(a.st)
        if (i % 15 === 0) {
          const d = Math.hypot(a.x - F.X, a.z - F.Z)
          let off = Math.atan2(a.z - F.Z, a.x - F.X) - F.mouth
          while (off > Math.PI) off -= 2 * Math.PI
          while (off < -Math.PI) off += 2 * Math.PI
          res.samples.push({ t: +g.state.time.toFixed(1), st: a.st, d: +d.toFixed(2), offDeg: Math.round(off * 180 / Math.PI) })
        }
        if (a.st === 'hand' && !res.hand) res.hand = a
      }
      return res
    })
    for (const s of r.states) if (out.states[out.states.length - 1] !== s) out.states.push(s)
    out.samples.push(...r.samples)
    if (r.hand && !handShot) {
      handShot = true
      out.hand = r.hand
      const F = await page.evaluate(() => window.__t3cFin)
      const cx = F.X + Math.cos(F.mouth) * 7.5, cz = F.Z + Math.sin(F.mouth) * 7.5
      await page.evaluate(() => { const g = window.__capy; for (let i = 0; i < 20; i++) g.tick(1 / 30, false) })
      await shot('hand', [cx, 2.6, cz], [F.X, 0.6, F.Z])
    }
    if (out.states[out.states.length - 1] === 'done') break
  }
  out.bag = await page.evaluate(() => window.__t3cBag)
  out.end = await page.evaluate(() => {
    const g = window.__capy, F = window.__t3cFin
    const cone = 25 * Math.PI / 180
    const chk = (x, z) => {
      let off = Math.atan2(z - F.Z, x - F.X) - F.mouth
      while (off > Math.PI) off -= 2 * Math.PI
      while (off < -Math.PI) off += 2 * Math.PI
      return { r: +Math.hypot(x - F.X, z - F.Z).toFixed(2), offDeg: Math.round(off * 180 / Math.PI), inCone: Math.abs(off) < cone }
    }
    const ga = g.gatherAudit()
    return { at: g.travFinAt(), trav: (() => { const a = g.travFinAt(); return a ? chk(a.x, a.z) : null })(),
             gather: ga.map(p => ({ slot: chk(p.gx, p.gz), now: chk(p.x, p.z) })), err: g.state.lastError || null }
  })
  const F = await page.evaluate(() => window.__t3cFin)
  await shot('end', [F.X + Math.cos(F.mouth) * 7.5, 2.6, F.Z + Math.sin(F.mouth) * 7.5], [F.X, 0.6, F.Z])
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
