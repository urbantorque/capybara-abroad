async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(6000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => { window.__capy.biome.switchTo('antarctic') })
  await page.waitForTimeout(1800)
  await page.evaluate(() => {
    const g = window.__capy, a = g.antarctic
    const h = a.boat.helm
    g.capy.body.position.set(h.x, h.y + 0.2, h.z)
    g.capy.body.velocity.set(0, 0, 0)
    window.__samp = []
    window.__evt = []
  })
  await page.waitForTimeout(1200)
  await page.keyboard.press('e')
  await page.waitForTimeout(500)

  const shot = async (n) => page.evaluate(async (nn) => {
    const g = window.__capy
    g.renderer.setSize(1280, 760, false)
    g.camera.aspect = 1280 / 760
    g.camera.updateProjectionMatrix()
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    await fetch('/shot?name=' + nn, { method: 'POST', body: g.renderer.domElement.toDataURL('image/png') })
  }, n)

  const steerTo = async (t, seconds) => {
    await page.keyboard.down('w')
    const end = Date.now() + seconds * 1000
    while (Date.now() < end) {
      const st = await page.evaluate((tt) => {
        const a = window.__capy.antarctic
        const bx = a.boat.position.x, bz = a.boat.position.z
        const want = Math.atan2(tt[0] - bx, tt[1] - bz)
        let e = want - a.boat.heading
        while (e > Math.PI) e -= Math.PI * 2
        while (e < -Math.PI) e += Math.PI * 2
        return { e, d: Math.hypot(tt[0] - bx, tt[1] - bz) }
      }, t)
      if (st.d < 30) break
      const key = st.e > 0.10 ? 'a' : st.e < -0.10 ? 'd' : null
      if (key) {
        const hold = Math.min(400, Math.max(70, Math.abs(st.e) * 260))
        await page.keyboard.down(key); await page.waitForTimeout(hold); await page.keyboard.up(key)
      } else { await page.waitForTimeout(200) }
    }
    await page.keyboard.up('w')
  }

  const target = await page.evaluate(() => { const q = window.__capy.antarctic.pod(); return [q.x, q.z + 120] })
  await steerTo(target, 75)

  // install an in-page 20 Hz sampler so the payout instant is not missed
  await page.evaluate(() => {
    const g = window.__capy
    window.__t0 = performance.now()
    window.__iv = setInterval(() => {
      const a = g.antarctic, c = g.camera, p = g.capy.position
      const dx = c.position.x - p.x, dz = c.position.z - p.z
      const dh = Math.hypot(dx, dz)
      // every orca mesh: find the antarctic root's 6-child pod group by ymax
      let pod = []
      const root = g.scene.getObjectByName('antarctic')
      if (root) {
        root.traverse(o => {
          if (o.isGroup && o.children.length === 6 && o.children[0] && o.children[0].isGroup) {
            pod = o.children.map(ch => ({ x: +ch.position.x.toFixed(1), y: +ch.position.y.toFixed(2), z: +ch.position.z.toFixed(1) }))
          }
        })
      }
      window.__samp.push({
        t: +((performance.now() - window.__t0) / 1000).toFixed(2),
        sp: +a.boat.speed.toFixed(2),
        wp: +a.withPod().toFixed(2),
        bz: +a.boat.position.z.toFixed(1),
        bx: +a.boat.position.x.toFixed(1),
        cam: [+c.position.x.toFixed(1), +c.position.y.toFixed(2), +c.position.z.toFixed(1)],
        capy: [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)],
        yaw: +(Math.atan2(dx, dz) * 180 / Math.PI).toFixed(1),
        dist: +dh.toFixed(2),
        pitch: +(Math.atan2(c.position.y - p.y, dh) * 180 / Math.PI).toFixed(1),
        hdg: +(a.boat.heading * 180 / Math.PI).toFixed(1),
        ride: g.hud.isTaskDone('orca-ride'),
        pod,
      })
      if (window.__samp.length > 900) clearInterval(window.__iv)
    }, 50)
  })

  await page.keyboard.press('q')
  await page.waitForTimeout(600)
  await page.keyboard.down('w')
  for (let i = 0; i < 22; i++) {
    await page.waitForTimeout(700)
    const e = await page.evaluate(() => {
      const a = window.__capy.antarctic
      let e2 = Math.PI - a.boat.heading
      while (e2 > Math.PI) e2 -= Math.PI * 2
      while (e2 < -Math.PI) e2 += Math.PI * 2
      return e2
    })
    const key = e > 0.12 ? 'a' : e < -0.12 ? 'd' : null
    if (key) { await page.keyboard.down(key); await page.waitForTimeout(130); await page.keyboard.up(key) }
  }
  await shot('b4ant-marquee.png')
  await page.keyboard.up('w')
  await page.evaluate(() => { clearInterval(window.__iv) })

  const out = await page.evaluate(() => {
    const g = window.__capy
    const s = window.__samp
    const firstRide = s.findIndex(k => k.ride)
    return {
      n: s.length,
      ride: g.hud.isTaskDone('orca-ride'),
      seenPod: g.antarctic.seenPod(),
      err: g.state.lastError || null,
      firstRideIdx: firstRide,
      atRide: firstRide >= 0 ? s[firstRide] : null,
      window: firstRide >= 0 ? s.slice(Math.max(0, firstRide - 90), firstRide + 8).filter((_, i) => i % 4 === 0) : s.slice(-40).filter((_, i) => i % 4 === 0),
    }
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b4ant-1.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
