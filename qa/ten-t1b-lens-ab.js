async page => {
  // THE RACE FRAME, STATION BY STATION (TEN T1b). The lap probe
  // (ten-t1b-lens.js) compares two different stretches of road, because a
  // headless lap does not finish in the time. This one drives the SAME
  // stations with the lens cut and live: the car is put 40 m short of each
  // station at 20 m/s with W held, and measured as it passes. Same ray grid.
  const PORT = 5192
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  for (let i = 0; i < 160; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capy && document.querySelector('.capyui-go')))) break }
  await page.waitForTimeout(1500)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go:not(.alt)') || document.querySelector('.capyui-go'); if (b) b.click() })
  for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
  await page.waitForTimeout(3000)
  await page.evaluate(async () => { const g = window.__capy; if (g.biome.current !== 'monaco') { g.state.journeyMode = 'free'; g.hud.cross('monaco'); await new Promise(r => setTimeout(r, 9000)) } })
  const out = { runs: [] }
  const ST = [20, 70, 120, 170, 220, 270, 320, 370, 420, 470, 520, 570, 620]
  for (const cut of [true, false]) {
    await page.evaluate((cut) => { const g = window.__capy; g.state.noMonRaceLens = cut; g.state.perfRung = 3; g.monaco.raceDebug({ take: true }) }, cut)
    await page.waitForTimeout(4500)
    const rows = []
    for (const st of ST) {
      await page.evaluate((st) => { const g = window.__capy; g.state.perfRung = 3; g.monaco.raceDebug({ s: st - 40, v: 20 }); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', bubbles: true })) }, st)
      for (let k = 0; k < 40; k++) { await page.waitForTimeout(100); const s = await page.evaluate(() => window.__capy.monaco.race().s); if (s >= st || s < st - 60) break }
      const s = await page.evaluate(() => {
        const g = window.__capy, T = g.THREE
        g.state.perfRung = 3
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', bubbles: true }))
        const race = g.monaco.race()
        let car = null, ground = null
        g.scene.traverse(x => { if (x.name === 'monMeCar') car = x; if (x.name === 'monGround') ground = x })
        let root = car; while (root.parent && root.parent !== g.scene) root = root.parent
        // a build without the name: the ground is the uncullable vertex-coloured
        // mesh with the most vertices under the chapter's root
        if (!ground) { let bn = 0; root.traverse(x => { if (x.isMesh && !x.isInstancedMesh && x.frustumCulled === false && x.geometry.attributes.color && x.geometry.attributes.position.count > bn) { bn = x.geometry.attributes.position.count; ground = x } }) }
        const cam = g.camera; cam.updateMatrixWorld()
        const rc = new T.Raycaster(); rc.far = 500
        const NX = 16, NY = 10
        let gN = 0, hitN = 0, carN = 0
        const v2 = new T.Vector2()
        for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
          v2.set(((i + 0.5) / NX) * 2 - 1, ((j + 0.5) / NY) * 2 - 1)
          rc.setFromCamera(v2, cam)
          const hits = rc.intersectObject(root, true)
          let h = null
          for (const x of hits) {
            let o = x.object, vis = true
            while (o) { if (!o.visible) { vis = false; break } o = o.parent }
            if (!vis) continue
            const m = Array.isArray(x.object.material) ? x.object.material[0] : x.object.material
            if (m && m.transparent && m.opacity < 0.6) continue
            h = x; break
          }
          if (!h) continue
          hitN++
          if (h.object === ground && g.monaco.roadD(h.point.x, h.point.z) > 5.4) gN++
          let o = h.object; while (o) { if (o === car) { carN++; break } o = o.parent }
        }
        const cw = new T.Vector3(); car.getWorldPosition(cw); cw.y += 0.6
        const ndc = cw.clone().project(cam)
        return { t: +g.state.time.toFixed(1), v: race.v, s: race.s, lap: race.lap, on: race.on,
          terrain: +(gN / (NX * NY)).toFixed(3), carCells: carN, ndc: [+ndc.x.toFixed(2), +ndc.y.toFixed(2)],
          camCar: +cam.position.distanceTo(cw).toFixed(1), camUp: +(cam.position.y - cw.y).toFixed(1) }
      })
      s.st = st
      rows.push(s)
      if (st === 120) await page.screenshot({ path: 'qa/ten-t1b-lens-ab-' + (cut ? 'cut' : 'live') + '.png' })
    }
    const mean = k => +(rows.reduce((a, x) => a + x[k], 0) / rows.length).toFixed(3)
    out.runs.push({ cut, n: rows.length, terrainMean: mean('terrain'), terrainMax: Math.max(...rows.map(x => x.terrain)),
      over25: rows.filter(x => x.terrain > 0.25).length, midThirdX: rows.filter(x => Math.abs(x.ndc[0]) < 1 / 3).length,
      midThirdXY: rows.filter(x => Math.abs(x.ndc[0]) < 1 / 3 && Math.abs(x.ndc[1]) < 1 / 3).length,
      carSeen: rows.filter(x => x.carCells > 0).length, camUpMean: mean('camUp'), rows })
    await page.evaluate(() => { const g = window.__capy; g.monaco.raceDebug({ v: 0 }); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w', bubbles: true })) })
    await page.waitForTimeout(500)
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true })))
    await page.waitForTimeout(300)
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', key: 'e', bubbles: true })))
    await page.waitForTimeout(1200)
  }
  out.lastError = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(async (o) => { await fetch('/shot?name=ten-t1b-lens-ab.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
