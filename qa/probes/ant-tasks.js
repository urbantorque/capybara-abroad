async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => { window.__capy.biome.switchTo('antarctic') })
  await page.waitForTimeout(1500)

  const put = (x, y, z) => page.evaluate((p) => {
    const g = window.__capy
    g.capy.body.position.set(p[0], p[1], p[2])
    g.capy.body.velocity.set(0, 0, 0)
    g.capy.body.angularVelocity.set(0, 0, 0)
  }, [x, y, z])
  const done = (id) => page.evaluate((i) => window.__capy.hud.isTaskDone(i), id)
  const snap = () => page.evaluate(() => {
    const g = window.__capy, p = g.capy.position
    return { x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1),
             slip: +(g.capy.slip || 0).toFixed(2), swim: !!g.capy.swimming,
             gnd: !!g.capy.grounded }
  })
  const out = {}

  // MOVEMENT IS CAMERA-RELATIVE AND camYaw DRIFTS, so the key set has to be
  // recomputed from game.input.camYaw and the world direction we actually
  // want, every few frames. W is input.z = -1; the controller does
  //   dx =  ix*cos(cam) + iz*sin(cam)
  //   dz = -ix*sin(cam) + iz*cos(cam)
  // so the inverse is ix = dx*cos - dz*sin, iz = dx*sin + dz*cos.
  const held = new Set()
  const setKeys = async (want) => {
    for (const k of Array.from(held)) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k) }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k) }
  }
  const drive = async (ux, uz, seconds, log, stop) => {
    const end = Date.now() + seconds * 1000
    while (Date.now() < end) {
      const st = await page.evaluate((u) => {
        const g = window.__capy
        const c = Math.cos(g.input.camYaw), s2 = Math.sin(g.input.camYaw)
        const m = Math.hypot(u[0], u[1]) || 1
        const dx = u[0] / m, dz = u[1] / m
        const p2 = g.capy.position, v = g.capy.body.velocity
        return { ix: dx * c - dz * s2, iz: dx * s2 + dz * c,
                 x: p2.x, y: p2.y, z: p2.z, sp: Math.hypot(v.x, v.z),
                 slip: g.capy.slip || 0, swim: !!g.capy.swimming }
      }, [ux, uz])
      const want = new Set()
      if (st.ix > 0.35) want.add('d'); else if (st.ix < -0.35) want.add('a')
      if (st.iz > 0.35) want.add('s'); else if (st.iz < -0.35) want.add('w')
      await setKeys(want)
      if (log) log.push([+st.x.toFixed(0), +st.y.toFixed(1), +st.z.toFixed(0),
                         +st.sp.toFixed(1), +st.slip.toFixed(2), st.swim ? 1 : 0])
      if (stop && stop(st)) break
      await page.waitForTimeout(220)
    }
    await setKeys(new Set())
  }

  // ---- 1. the mug, in the bar hut ---------------------------------------
  const mug = await page.evaluate(() => { const q = window.__capy.antarctic.mug(); return [q.x, q.y, q.z] })
  await put(mug[0], mug[1] + 1.0, mug[2] + 1.1)
  await page.waitForTimeout(1400)
  await page.keyboard.press('e')
  await page.waitForTimeout(600)
  out.mug = { at: mug.map(v => +v.toFixed(1)), done: await done('station-mug'), state: await snap() }

  // ---- 2. the whale bones -----------------------------------------------
  const bones = await page.evaluate(() => {
    const a = window.__capy.antarctic
    return [a.bones.x, a.terrainHeight(a.bones.x, a.bones.z) + 1.6, a.bones.z]
  })
  await put(bones[0], bones[1], bones[2])
  await page.waitForTimeout(4500)
  out.bones = { done: await done('whale-bones'), state: await snap() }

  // ---- 3. the penguin highway -------------------------------------------
  await page.evaluate(() => {
    const g = window.__capy, a = g.antarctic
    const x = a.highTop.x, z = a.highTop.z
    g.capy.body.position.set(x, a.terrainHeight(x, z) + 1.2, z)
    g.capy.body.velocity.set(0, 0, 0)
  })
  await page.waitForTimeout(1200)
  const hw = []
  // downhill is -z and a little -x; the track curves, so just aim at the foot
  // the track BENDS: aim at each control point in turn, which is what a
  // player following a worn groove downhill actually does
  for (const pt of [[18, 74], [12, 58], [6, 42]]) {
    const at = await page.evaluate(() => [window.__capy.capy.position.x, window.__capy.capy.position.z])
    await drive(pt[0] - at[0], pt[1] - at[1], 9, hw,
                (st) => Math.hypot(st.x - pt[0], st.z - pt[1]) < 7)
  }
  out.highway = { trace: hw, done: await done('penguin-highway'), state: await snap() }

  // ---- 4. the blue ice ---------------------------------------------------
  await page.evaluate(() => {
    const g = window.__capy, a = g.antarctic
    // top of the tongue, on the fall line
    const x = -178, z = (a.blueIce.z)
    g.capy.body.position.set(x, a.terrainHeight(x, z) + 1.2, z)
    g.capy.body.velocity.set(0, 0, 0)
  })
  await page.waitForTimeout(1500)
  const bi = []
  // the fall line is +x: the glacier's height is a function of x alone
  await drive(1, 0, 18, bi, (st) => st.swim)
  await page.waitForTimeout(2000)
  out.blueIce = { trace: bi, done: await done('blue-ice'), state: await snap() }

  // ---- 5. climbing the snow shoulder back up -----------------------------
  await page.evaluate(() => {
    const g = window.__capy, a = g.antarctic
    g.capy.body.position.set(-96, a.terrainHeight(-96, -40) + 1.2, -40)
    g.capy.body.velocity.set(0, 0, 0)
  })
  await page.waitForTimeout(1200)
  const climbA = await snap()
  const climbLog = []
  await drive(-1, 0, 9, climbLog, null)      // uphill is -x
  const climbB = await snap()
  out.climbLog = climbLog
  out.climb = { from: climbA, to: climbB, gained: +(climbB.y - climbA.y).toFixed(2) }

  // ---- 6. haul out on a floe and ride it --------------------------------
  const f = await page.evaluate(() => { const q = window.__capy.antarctic.nearestFloe(); return [q.x, q.z] })
  await put(f[0], 2.0, f[1])
  await page.waitForTimeout(3000)
  const haul = await snap()
  const ride = []
  for (let i = 0; i < 48; i++) {
    await page.waitForTimeout(1000)
    ride.push(await page.evaluate(() => {
      const g = window.__capy, p = g.capy.position
      return [+p.x.toFixed(0), +p.z.toFixed(0), g.capy.swimming ? 1 : 0, g.capy.grounded ? 1 : 0]
    }))
  }
  out.floe = { haul, ride, hauled: await done('haul-out'), drift: await done('floe-drift'),
               state: await snap() }

  // ---- 7. the leopard seal ----------------------------------------------
  const sl = await page.evaluate(() => { const q = window.__capy.antarctic.seal(); return [q.x, q.z] })
  await put(sl[0] + 6, 2.0, sl[1] + 6)
  await page.waitForTimeout(2500)
  out.seal = { done: await done('leopard-seal'), state: await snap() }

  out.err = await page.evaluate(() => ({ err: window.__capy.state.lastError || null,
                                         saves: window.__capy.state.solverSaves || 0 }))
  await page.evaluate(async (o) => {
    await fetch('/shot?name=anttasks.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
