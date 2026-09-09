async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => { window.__capy.biome.switchTo('antarctic') })
  await page.waitForTimeout(1500)
  await page.evaluate(() => {
    const g = window.__capy, a = g.antarctic
    const h = a.boat.helm
    g.capy.body.position.set(h.x, h.y + 0.2, h.z)
    g.capy.body.velocity.set(0, 0, 0)
  })
  await page.waitForTimeout(1200)
  await page.keyboard.press('e')
  await page.waitForTimeout(400)


  const capture = async (n) => page.evaluate(async (nn) => {
    const g = window.__capy
    g.renderer.setSize(1280, 760, false)
    g.camera.aspect = 1280 / 760
    g.camera.updateProjectionMatrix()
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    await fetch('/shot?name=' + nn, { method: 'POST', body: g.renderer.domElement.toDataURL('image/png') })
  }, n)

  // closed-loop autopilot: steer toward a world point, throttle held open
  const steerTo = async (tx, tz, seconds, log) => {
    await page.keyboard.down('w')
    const end = Date.now() + seconds * 1000
    while (Date.now() < end) {
      const st = await page.evaluate((t) => {
        const a = window.__capy.antarctic
        const bx = a.boat.position.x, bz = a.boat.position.z
        const want = Math.atan2(t[0] - bx, t[1] - bz)
        let e = want - a.boat.heading
        while (e > Math.PI) e -= Math.PI * 2
        while (e < -Math.PI) e += Math.PI * 2
        return { e, d: Math.hypot(t[0] - bx, t[1] - bz), sp: a.boat.speed,
                 x: bx, z: bz, pack: a.pack(), pod: a.withPod() }
      }, [tx, tz])
      if (log) log.push([+st.x.toFixed(0), +st.z.toFixed(0), +st.sp.toFixed(1),
                         +st.d.toFixed(0), +st.pod.toFixed(2)])
      if (st.d < 22) break
      const key = st.e > 0.10 ? 'a' : st.e < -0.10 ? 'd' : null
      if (key) {
        const hold = Math.min(400, Math.max(70, Math.abs(st.e) * 260))
        await page.keyboard.down(key); await page.waitForTimeout(hold); await page.keyboard.up(key)
      } else {
        await page.waitForTimeout(200)
      }
    }
    await page.keyboard.up('w')
  }

  const leg = []
  const target = await page.evaluate(() => {
    const q = window.__capy.antarctic.pod()
    return [q.x, q.z]
  })
  await steerTo(target[0], target[1] + 90, 60, leg)
  const near = await page.evaluate(() => {
    const a = window.__capy.antarctic
    const q = a.pod()
    return { boat: [+a.boat.position.x.toFixed(0), +a.boat.position.z.toFixed(0)],
             pod: [+q.x.toFixed(0), +q.z.toFixed(0)],
             d: +Math.hypot(q.x - a.boat.position.x, q.z - a.boat.position.z).toFixed(0) }
  })
  await page.keyboard.press('q')
  await page.waitForTimeout(500)
  // now hold speed while they form up
  const hold = []
  await page.keyboard.down('w')
  for (let i = 0; i < 26; i++) {
    await page.waitForTimeout(900)
    hold.push(await page.evaluate(() => {
      const a = window.__capy.antarctic
      return [+a.withPod().toFixed(2), +a.boat.speed.toFixed(1),
              +a.boat.position.z.toFixed(0), +a.pack().toFixed(2)]
    }))
    // keep her pointed north, away from the shelf and out of the shore
    const e = await page.evaluate(() => {
      const a = window.__capy.antarctic
      let e2 = Math.PI - a.boat.heading
      while (e2 > Math.PI) e2 -= Math.PI * 2
      while (e2 < -Math.PI) e2 += Math.PI * 2
      return e2
    })
    const key = e > 0.12 ? 'a' : e < -0.12 ? 'd' : null
    if (key) { await page.keyboard.down(key); await page.waitForTimeout(140); await page.keyboard.up(key) }
  }
  await page.keyboard.up('w')
  await capture('ant-11-escort')
  const rode = await page.evaluate(() => {
    const g = window.__capy
    return { ride: g.hud.isTaskDone('orca-ride'), seenPod: g.antarctic.seenPod(),
             withPod: +g.antarctic.withPod().toFixed(2), err: g.state.lastError || null }
  })
  // now STOP and wait to be spy-hopped
  // just hold S, the way anybody would, and let the detent stop her
  await page.keyboard.down('s')
  await page.waitForTimeout(4000)
  await page.keyboard.up('s')
  await page.waitForTimeout(4200)
  await capture('ant-14-spyhop')
  await page.waitForTimeout(4800)
  const spy = await page.evaluate(() => {
    const g = window.__capy
    return { spy: g.hud.isTaskDone('spy-hop'), sp: +g.antarctic.boat.speed.toFixed(2),
             withPod: +g.antarctic.withPod().toFixed(2), err: g.state.lastError || null }
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=antpod.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, { leg: leg.slice(-14), near, hold, rode, spy })
}
