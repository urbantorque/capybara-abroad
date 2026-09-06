async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)

  const out = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE
    const res = { err: null, fit: {}, errs: [] }
    try {
      const W = 1280, H = 760
      g.renderer.setSize(W, H, false)
      const rc = document.createElement('canvas'); rc.width = W; rc.height = H
      const rx = rc.getContext('2d', { willReadFrequently: true })
      const my = (g.capy.model || g.capy.group).rotation.y
      const p = g.capy.position
      const aim = new T.Vector3(p.x, p.y + 0.16, p.z)

      function shoot(yawOff, dist, up, fov) {
        const yaw = my + yawOff
        const c = new T.PerspectiveCamera(fov, W / H, 0.02, 400)
        c.position.set(aim.x + Math.sin(yaw) * dist, aim.y + up, aim.z + Math.cos(yaw) * dist)
        c.lookAt(aim.x, aim.y, aim.z); c.updateMatrixWorld()
        g.renderer.setRenderTarget(null)
        g.renderer.render(g.scene, c)
        rx.clearRect(0, 0, W, H); rx.drawImage(g.renderer.domElement, 0, 0, W, H)
        return { png: g.renderer.domElement.toDataURL('image/png'),
                 d: rx.getImageData(0, 0, W, H).data }
      }

      // IS THE BODY COMING THROUGH THE COSTUME? A costume is a shell over a
      // shape; the honest test is whether any FUR pixel survives inside the
      // garment's own silhouette. Take the animal's own materials away — set
      // every fur colour to a flag value — and count how much of it shows.
      let hull = null
      g.capy.group.traverse(o => { if (o.name === 'capyHull') hull = o })
      if (!hull) throw new Error('no hull')

      // no tick may run between wear() and the render: systems.js re-asserts
      // the chapter's costume every frame, so a tick here undresses the animal
      for (const id of ['black-tie', 'parka']) {
        g.capy.wear(id)
        const hex = hull.material.color.getHex()
        hull.material.color.setHex(0xff00ff)
        const on = shoot(Math.PI * 0.5, 3.0, 0.55, 26)
        const on3 = shoot(Math.PI * 0.78, 3.0, 0.95, 26)
        const onF = shoot(Math.PI * 0.20, 3.0, 0.75, 26)
        hull.material.color.setHex(hex)
        let bleed = 0
        for (const f of [on, on3, onF]) {
          for (let i = 0; i < f.d.length; i += 4) {
            if (f.d[i] > 150 && f.d[i + 1] < 90 && f.d[i + 2] > 150) bleed++
          }
        }
        res.fit[id] = { bleed }
        const s = shoot(Math.PI * 0.5, 3.0, 0.55, 26)
        await fetch('/shot?name=R2w-' + id + '-side', { method: 'POST', body: s.png })
        const r = shoot(Math.PI * 0.80, 3.0, 1.10, 26)
        await fetch('/shot?name=R2w-' + id + '-rear', { method: 'POST', body: r.png })
      }
      g.capy.wear(null)
      res.lastError = g.state && g.state.lastError ? String(g.state.lastError) : null
    } catch (e) { res.err = String((e && e.stack) || e) }
    return res
  })
  out.errs = errs
  await page.evaluate(async o => {
    await fetch('/shot?name=R2w-result.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
