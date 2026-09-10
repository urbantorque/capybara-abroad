async page => {
  // rd-tight.js — go and FIND the cut, in the four chapters most likely to have
  // one, by walking off in six directions from the spawn and settling at each.
  //
  // The failure being looked for is specific: a settled frame where the boom is
  // cut AND the pitch has been dragged back up toward the driving lens by the
  // cut rather than by the latch. The tell is a settled pitch in the twenties
  // with `rest` still near 0.8 — the crane asking for a shot the place is
  // refusing to give, which is a close-up of the animal's head.
  const out = { rows: [] }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(2500)
  out.started = await page.evaluate(() => window.__capy.state.started)

  const read = () => page.evaluate(() => {
    const g = window.__capy
    const cam = g.camera
    cam.updateMatrixWorld(true)
    const fwd = new g.THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
    const p = g.capy.position
    const v = new g.THREE.Vector3(p.x, p.y + 0.35, p.z).project(cam)
    return { pitch: +(Math.asin(-fwd.y) * 180 / Math.PI).toFixed(1),
             rest: +(g.camInfo.rest || 0).toFixed(2),
             clear: +(g.camInfo.clear || 1).toFixed(2),
             dist: +(g.camInfo.dist || 0).toFixed(1),
             onScreen: Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z < 1,
             fromTop: +((1 - v.y) / 2).toFixed(2) }
  })

  const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyW', 'KeyD']
  for (const b of ['quay', 'kowloon', 'cave', 'venice', 'hanoi', 'monaco']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(8000)
    for (let k = 0; k < keys.length; k++) {
      await page.keyboard.down(keys[k])
      await page.waitForTimeout(2200 + k * 400)
      await page.keyboard.up(keys[k])
      await page.waitForTimeout(9500)      // settle well past the 2.5 s blend
      const r = await read()
      // sample twice, four seconds apart: a latch is flat, a scale breathes
      await page.waitForTimeout(4000)
      const r2 = await read()
      out.rows.push(Object.assign({ b: b, leg: keys[k] + k }, r,
        { pitch2: r2.pitch, rest2: r2.rest, clear2: r2.clear }))
    }
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rd-tight.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
