async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(6000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => { window.__capy.biome.switchTo('antarctic') })
  await page.waitForTimeout(1800)
  await page.evaluate(() => {
    const g = window.__capy
    const h = g.antarctic.boat.helm
    g.capy.body.position.set(h.x, h.y + 0.2, h.z)
    g.capy.body.velocity.set(0, 0, 0)
    // find the pod group by the blow puff it contains, and the floe meshes by
    // their freeboard height. ASSERT ON THE SETUP.
    const root = g.scene.getObjectByName('antarctic')
    let podG = null
    root.traverse(o => { if (o.name === 'antBlow' && o.parent) podG = o.parent })
    window.__pod = podG ? podG.children.filter(c => c.name !== 'antBlow') : null
    const W = g.antarctic.waterLevel
    const floes = []
    root.traverse(o => {
      if (o.isMesh && !o.isInstancedMesh && Math.abs(o.position.y - (W + 0.34)) < 0.02 &&
          o.geometry && o.geometry.boundingSphere !== undefined) floes.push(o)
    })
    window.__floes = floes
  })
  await page.waitForTimeout(600)
  const setup = await page.evaluate(() => ({
    pod: window.__pod ? window.__pod.length : 0,
    floes: window.__floes ? window.__floes.length : 0,
  }))
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

  await page.evaluate(() => {
    const g = window.__capy
    window.__ov = []
    window.__iv = setInterval(() => {
      const a = g.antarctic
      if (a.withPod() <= 0) return
      const P = window.__pod, F = window.__floes
      if (!P || !F) return
      let inFloe = 0, minEdge = 99
      const ys = []
      for (const m of P) {
        ys.push(+m.position.y.toFixed(2))
        for (const f of F) {
          const dx = m.position.x - f.position.x, dz = m.position.z - f.position.z
          const bs = f.geometry.boundingSphere
          const r = bs ? bs.radius : 0
          const d = Math.hypot(dx, dz)
          if (d < r) { inFloe++; break }
          if (d - r < minEdge) minEdge = +(d - r).toFixed(1)
        }
      }
      window.__ov.push({ t: +g.state.time.toFixed(1), inFloe, minEdge, ys,
                         pack: +a.packAt(a.pod().x, a.pod().z).toFixed(2) })
    }, 200)
  })

  await page.keyboard.press('q')
  await page.waitForTimeout(600)
  await page.keyboard.down('w')
  // wait for form-up
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500)
    const wp = await page.evaluate(() => window.__capy.antarctic.withPod())
    if (wp > 0.4) break
  }
  await page.waitForTimeout(5800)      // the breach fires at ride 5.58 s
  await shot('b4ant-breach.png')
  await page.waitForTimeout(4200)
  await shot('b4ant-payout.png')
  // and hold ten more seconds past the tick, to count the one-shot
  await page.waitForTimeout(10000)
  await page.keyboard.up('w')
  await page.evaluate(() => { clearInterval(window.__iv) })

  const out = await page.evaluate(() => {
    const g = window.__capy
    // the toast stack, read from the DOM: recordValue's toast is NOT game.toast
    const txt = []
    document.querySelectorAll('div').forEach(d => {
      const t = (d.textContent || '')
      if (t.indexOf('personal best') === 0 && t.length < 90) txt.push(t)
    })
    const ov = window.__ov
    return {
      setup: { pod: window.__pod ? window.__pod.length : 0, floes: window.__floes ? window.__floes.length : 0 },
      ride: g.hud.isTaskDone('orca-ride'), err: g.state.lastError || null,
      nOv: ov.length,
      overlapFrames: ov.filter(o => o.inFloe > 0).length,
      maxInFloe: ov.reduce((m, o) => Math.max(m, o.inFloe), 0),
      ovSample: ov.filter((_, i) => i % 12 === 0).slice(0, 14),
      pbToasts: txt.slice(0, 6), pbCount: txt.length,
      podY: window.__pod ? window.__pod.map(m => +m.position.y.toFixed(2)) : null,
      water: g.antarctic.waterLevel,
    }
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b4ant-3.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
