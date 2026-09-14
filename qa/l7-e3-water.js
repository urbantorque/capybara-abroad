async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.addInitScript(() => { window.__l7e3tag = 'after' })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6500)
  const TAG = await page.evaluate(() => (window.__l7e3tag || 'run'))
  const out = { started: null, tag: TAG, sydney: {}, venice: {} }
  out.started = await page.evaluate(() => window.__capy && window.__capy.state && window.__capy.state.started)
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a }
  const info = async () => page.evaluate(() => {
    const g = window.__capy, T = g.THREE, cam = g.camera
    const fwd = new T.Vector3(); cam.getWorldDirection(fwd)
    const pitch = Math.asin(-fwd.y)
    const box = new T.Box3().setFromObject(g.capy.group)
    const ctr = box.getCenter(new T.Vector3())
    const pts = []
    for (let i = 0; i < 8; i++) { const p = new T.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z); p.project(cam); pts.push(p) }
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    const inFrame = x1 > -1 && x0 < 1 && y1 > -1 && y0 < 1 && pts.every(p => p.z < 1)
    const ci = g.camInfo || {}
    const c = g.capy
    return { x: +c.position.x.toFixed(2), y: +c.position.y.toFixed(2), z: +c.position.z.toFixed(2),
      swim: !!c.swimming, dive: !!c.diving, depth: +((c.depth || 0)).toFixed(2),
      camY: +cam.position.y.toFixed(2), rig: +cam.position.distanceTo(ctr).toFixed(1), pitch: +(pitch * 180 / Math.PI).toFixed(1),
      pxH: +((y1 - y0) / 2 * 760).toFixed(0), pxW: +((x1 - x0) / 2 * 1280).toFixed(0), cx: +((x0 + x1) / 4 + 0.5).toFixed(2), cy: +(0.5 - (y0 + y1) / 4).toFixed(2), inFrame,
      clear: +(ci.clear || 0).toFixed(2), rest: +(ci.rest || 0).toFixed(2), rigT: +(ci.rig || 0).toFixed(2), sub: ci.sub === undefined ? null : +ci.sub.toFixed(2),
      camYaw: +g.input.camYaw.toFixed(2), err: g.state.lastError ? String(g.state.lastError).slice(0, 80) : null }
  })
  const put = (x, y, z) => page.evaluate(([x, y, z]) => { const b = window.__capy.capy.body; b.position.set(x, y, z); b.velocity.set(0, 0, 0); if (b.interpolatedPosition) b.interpolatedPosition.set(x, y, z) }, [x, y, z])
  // turn the rig by hand until the camera sits at bearing `want` FROM the animal
  const face = async (want) => {
    for (let i = 0; i < 40; i++) {
      const cy = await page.evaluate(() => window.__capy.input.camYaw)
      const e = wrap(want - cy)
      if (Math.abs(e) < 0.12) break
      const k = e > 0 ? 'KeyZ' : 'KeyX'
      await page.keyboard.down(k); await page.waitForTimeout(Math.min(400, 60 + Math.abs(e) * 250)); await page.keyboard.up(k)
      await page.waitForTimeout(120)
    }
    // the hand gate holds the bearing for 1.6 s; wait it out so the walk is on the rig it was aimed at
    await page.waitForTimeout(200)
  }
  // ---- Sydney: W from three quay points with the lens north of the animal (W walks -z, into the harbour)
  const SPOTS = { stair: [-22, 0.3, -6], wharf: [-40, 0.3, -6], west: [-50, 0.3, -6] }
  for (const nm in SPOTS) {
    const s = SPOTS[nm]
    await put(s[0], s[1], s[2]); await page.waitForTimeout(800)
    await face(0)
    const rows = [await info()]
    await page.keyboard.down('KeyW')
    for (let k = 0; k < 8; k++) { await page.waitForTimeout(500); rows.push(await info()) }
    await page.keyboard.up('KeyW')
    await page.screenshot({ path: 'qa/l7-e3-' + TAG + '-syd-' + nm + '.png' })
    out.sydney[nm] = { rows, wet: rows.some(r => r.y < 0), swam: rows.some(r => r.swim), end: rows[rows.length - 1] }
    await page.waitForTimeout(500)
  }
  // ---- Venice: the lagoon off the Molo
  await page.evaluate(() => window.__capy.hud.cross('venice'))
  await page.waitForTimeout(9000)
  await put(0, 0.6, 27); await page.waitForTimeout(1500)
  await face(Math.PI)   // lens south of the animal, looking north at the Molo and the square
  const swimRows = []
  for (let k = 0; k < 10; k++) { await page.waitForTimeout(500); swimRows.push(await info()) }
  await page.screenshot({ path: 'qa/l7-e3-' + TAG + '-ven-swim.png' })
  out.venice.swim = { rows: swimRows, rigMax: Math.max(...swimRows.slice(4).map(r => r.rig)), pitchEnd: swimRows[swimRows.length - 1].pitch }
  // the dive: E held
  const diveRows = []
  await page.keyboard.down('KeyE')
  for (let k = 0; k < 10; k++) {
    await page.waitForTimeout(300); diveRows.push(await info())
    if (k === 7) await page.screenshot({ path: 'qa/l7-e3-' + TAG + '-ven-dive.png' })
  }
  await page.keyboard.up('KeyE')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'qa/l7-e3-' + TAG + '-ven-dive2.png' })
  const under = diveRows.filter(r => r.y < -0.5)
  out.venice.dive = { rows: diveRows, underN: under.length, camUnderN: under.filter(r => r.camY < 0).length,
    pxHMin: under.length ? Math.min(...under.map(r => r.pxH)) : null, inFrameN: under.filter(r => r.inFrame).length }
  // ...and the reviewer's case: a dive 5 m off the Molo's edge, the lens between the animal and the quay
  await page.waitForTimeout(2500)
  await put(0, 0.6, 21.5); await page.waitForTimeout(1500)
  await face(Math.PI)
  const moloRows = []
  await page.keyboard.down('KeyE')
  for (let k = 0; k < 10; k++) {
    await page.waitForTimeout(300); moloRows.push(await info())
    if (k === 7) await page.screenshot({ path: 'qa/l7-e3-' + TAG + '-ven-molo.png' })
  }
  await page.keyboard.up('KeyE')
  const under2 = moloRows.filter(r => r.y < -0.5)
  out.venice.molo = { rows: moloRows, underN: under2.length, camUnderN: under2.filter(r => r.camY < 0).length,
    pxHMin: under2.length ? Math.min(...under2.map(r => r.pxH)) : null, inFrameN: under2.filter(r => r.inFrame).length }
  await page.evaluate((o) => fetch('/shot?name=l7-e3-water-' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
