async page => {
  // T1d: is the animal at the wheel SOLID in the helm lens? Hide-and-diff on
  // the capy group, in a mask taken with the boat hidden. `vis` is the share
  // of the animal's own pixels that change when it is hidden with the boat
  // drawn: ~1 solid, ~0.5 a screen-door ghost, ~0 behind the house.
  const TAG = 'ten-t1d-helm'
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5194/', { waitUntil: 'commit', timeout: 120000 })
  await page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go'), null, { timeout: 120000 })
  await page.waitForTimeout(3000)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(6000)
  await page.evaluate(() => { window.__capy.state.journeyMode = 'free'; window.__capy.hud.cross('quay') })
  await page.waitForFunction(() => window.__capy.biome.current === 'quay' && window.__capy.quay && window.__capy.quay.helmDebug, null, { timeout: 90000 })
  await page.waitForTimeout(4000)
  // onto the foredeck under the bridge, and take the wheel with a real E
  await page.evaluate(() => {
    const g = window.__capy, a = g.quay.passageAudit(), cb = g.capy.body
    const cs = Math.cos(a.yaw), sn = Math.sin(a.yaw), lx = 0.9, lz = 2.6
    cb.position.set(a.x + sn * lz + cs * lx, g.quay.boat.position.y + 0.8, a.z + cs * lz - sn * lx)
    cb.velocity.set(0, 0, 0)
  })
  await page.waitForTimeout(900)
  await page.keyboard.down('KeyE'); await page.waitForTimeout(140); await page.keyboard.up('KeyE')
  await page.waitForTimeout(600)
  const helmByE = await page.evaluate(() => window.__capy.quay.passageAudit().helm)
  if (!helmByE) await page.evaluate(() => window.__capy.quay.helmDebug(true))
  await page.keyboard.down('KeyW')
  const out = { started: await page.evaluate(() => window.__capy.state.started), biome: await page.evaluate(() => window.__capy.biome.current), s: [] }
  const sample = () => page.evaluate(() => {
    const g = window.__capy, T = g.THREE, cam = g.camera, r = g.renderer
    const yaw = g.capy.group.rotation.y, cs = Math.cos(yaw), sn = Math.sin(yaw)
    const bp = g.quay.boat.position
    const loc = (p) => { const dx = p.x - bp.x, dz = p.z - bp.z; return [+(cs * dx - sn * dz).toFixed(2), +(p.y - bp.y).toFixed(2), +(sn * dx + cs * dz).toFixed(2)] }
    const boat = g.scene.getObjectByName('quayBoat')
    const W = 640, H = 380
    const RT = window.__t1rt || (window.__t1rt = new T.WebGLRenderTarget(W, H))
    const P = window.__t1p || (window.__t1p = [0, 1, 2, 3].map(() => new Uint8Array(W * H * 4)))
    const prevRT = r.getRenderTarget(), prevAuto = r.shadowMap.autoUpdate
    r.shadowMap.autoUpdate = false
    r.setRenderTarget(RT)
    const shot = (capyOn, boatOn, i) => { g.capy.group.visible = capyOn; if (boat) boat.visible = boatOn; r.render(g.scene, cam); r.readRenderTargetPixels(RT, 0, 0, W, H, P[i]) }
    shot(true, true, 0); shot(false, true, 1); shot(true, false, 2); shot(false, false, 3)
    g.capy.group.visible = true; if (boat) boat.visible = true
    r.setRenderTarget(prevRT); r.shadowMap.autoUpdate = prevAuto
    const dif = (a, b, k) => Math.max(Math.abs(a[k] - b[k]), Math.abs(a[k + 1] - b[k + 1]), Math.abs(a[k + 2] - b[k + 2])) > 20
    let mask = 0, seen = 0
    for (let k = 0; k < W * H * 4; k += 4) {
      if (!dif(P[2], P[3], k)) continue
      mask++
      if (dif(P[0], P[1], k)) seen++
    }
    return { t: +g.state.time.toFixed(1), rung: g.state.perfRung, speed: +(g.quay.whaleAudit().speed), boat: [+bp.x.toFixed(1), +bp.z.toFixed(1)],
      cam: loc(cam.position), capy: loc(g.capy.group.position), boatObj: !!boat, mask, seen, vis: mask ? +(seen / mask).toFixed(3) : null }
  })
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1200)
    out.s.push(await sample())
    if (i === 4) await page.screenshot({ path: 'qa/' + TAG + '-run.png' })
  }
  await page.keyboard.up('KeyW')
  out.helmByE = helmByE
  out.solidN = out.s.filter(x => x.vis !== null && x.vis > 0.85).length
  out.visMean = +(out.s.reduce((a, x) => a + (x.vis || 0), 0) / out.s.length).toFixed(3)
  // ...and E again: the animal is put down on the foredeck, not left on the roof
  await page.keyboard.down('KeyE'); await page.waitForTimeout(140); await page.keyboard.up('KeyE')
  await page.waitForTimeout(1500)
  out.stepDown = await page.evaluate(() => {
    const g = window.__capy, a = g.quay.passageAudit(), p = g.capy.body.position, bp = g.quay.boat.position
    const cs = Math.cos(a.yaw), sn = Math.sin(a.yaw), dx = p.x - bp.x, dz = p.z - bp.z
    return { helm: a.helm, lx: +(cs * dx - sn * dz).toFixed(2), ly: +(p.y - bp.y).toFixed(2), lz: +(sn * dx + cs * dz).toFixed(2) }
  })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
}
