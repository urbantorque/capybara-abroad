async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => { window.__capy.biome.switchTo('antarctic') })
  await page.waitForTimeout(2000)

  // Camera-relative movement, recomputed from the live camYaw. See the note in
  // qa/ant-tasks.js: the rig swings behind the animal after a second of idling,
  // so walking a short way in the direction we want the SHOT to face and then
  // standing still is the only way to frame anything deterministically.
  const held = new Set()
  const setKeys = async (want) => {
    for (const k of Array.from(held)) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k) }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k) }
  }
  const walk = async (ux, uz, seconds) => {
    const end = Date.now() + seconds * 1000
    while (Date.now() < end) {
      const st = await page.evaluate((u) => {
        const g = window.__capy
        const c = Math.cos(g.input.camYaw), s2 = Math.sin(g.input.camYaw)
        const m = Math.hypot(u[0], u[1]) || 1
        return { ix: (u[0] / m) * c - (u[1] / m) * s2, iz: (u[0] / m) * s2 + (u[1] / m) * c }
      }, [ux, uz])
      const want = new Set()
      if (st.ix > 0.35) want.add('d'); else if (st.ix < -0.35) want.add('a')
      if (st.iz > 0.35) want.add('s'); else if (st.iz < -0.35) want.add('w')
      await setKeys(want)
      await page.waitForTimeout(150)
    }
    await setKeys(new Set())
  }

  const capture = async (name) => {
    await page.evaluate(async (n) => {
      const g = window.__capy
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280 / 760
      g.camera.updateProjectionMatrix()
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      await fetch('/shot?name=' + n, { method: 'POST', body: g.renderer.domElement.toDataURL('image/png') })
    }, name)
  }
  /** teleport, face a world direction by walking it, settle, shoot */
  const shot = async (name, at, face, settle) => {
    await page.evaluate((p) => {
      const g = window.__capy
      g.capy.body.position.set(p[0], p[1], p[2])
      g.capy.body.velocity.set(0, 0, 0)
      g.capy.body.angularVelocity.set(0, 0, 0)
    }, at)
    await page.waitForTimeout(1000)
    if (face) await walk(face[0], face[1], 1.1)
    await page.waitForTimeout(settle || 2600)
    await capture(name)
  }

  const P = await page.evaluate(() => {
    const g = window.__capy, a = g.antarctic
    const T = (x, z) => a.terrainHeight(x, z)
    const sp = g.biome.spawnOf('antarctic')
    return {
      spawn: [sp.x, sp.y, sp.z],
      colony: [a.colony.x, T(a.colony.x, a.colony.z + 8) + 1.4, a.colony.z + 8],
      bar: (() => { const q = a.mug(); return [q.x, q.y + 1.0, q.z - 8] })(),
      highTop: [a.highTop.x, T(a.highTop.x, a.highTop.z + 5) + 1.4, a.highTop.z + 5],
      jetty: [0, 1.6, 34],
      helm: [a.boat.helm.x, a.boat.helm.y, a.boat.helm.z],
      glacier: [a.glacierToe.x + 30, 1.0, a.glacierToe.z + 20],
      blue: [-150, T(-150, a.blueIce.z) + 1.4, a.blueIce.z],
      bones: [a.bones.x, T(a.bones.x, a.bones.z + 16) + 1.4, a.bones.z + 16],
      seal: (() => { const q = a.seal(); return [q.x, 1.6, q.z + 16] })(),
      berg: [a.berg.x, 1.4, a.berg.z + 52],
    }
  })

  await shot('ant-1-spawn', P.spawn, [0, -1])          // downhill, at the jetty
  await shot('ant-2-colony', P.colony, [0, 1])         // uphill into the rookery
  await shot('ant-12-bar', P.bar, [0, 1])              // at the counter
  await shot('ant-13-highway', P.highTop, [-14, -46])  // down the track
  await shot('ant-3-jetty', P.jetty, [0, -1])          // down the jetty at the boat

  // under way in the pack, then with the pod on
  await shot('ant-4-pack', P.helm, null, 900)
  await page.keyboard.press('e')
  await page.waitForTimeout(500)
  await page.keyboard.down('w')
  await page.waitForTimeout(14000)
  await page.keyboard.up('w')
  await capture('ant-4-pack')
  await page.keyboard.press('q')
  await page.waitForTimeout(600)
  await page.keyboard.down('w')
  await page.waitForTimeout(18000)
  await page.keyboard.up('w')
  await capture('ant-11-escort')
  await page.waitForTimeout(6000)
  await capture('ant-14-spyhop')
  await page.keyboard.press('e')
  await page.waitForTimeout(600)

  await shot('ant-5-glacier', P.glacier, [-1, -0.4])
  await shot('ant-6-blue', P.blue, [1, 0])
  await shot('ant-9-bones', P.bones, [0, -1])
  await shot('ant-10-seal', P.seal, [0, -1])
  await shot('ant-8-berg', P.berg, [0, -1])

  const err = await page.evaluate(() => ({ err: window.__capy.state.lastError || null,
                                           saves: window.__capy.state.solverSaves || 0 }))
  await page.evaluate(async (o) => {
    await fetch('/shot?name=antshots.json', { method: 'POST', body: btoa(JSON.stringify(o)) })
  }, err)
}
