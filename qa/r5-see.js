async page => {
  // HOW BIG SHOULD THE BREATH BE? The hand-off says 0.010 of the animal on the
  // y scale; R2 shipped a term worth 0.0182 of the same thing measured at the
  // top of the back. Neither number can be argued about in the abstract, so:
  // hold the animal still, set the squash node to each candidate's two
  // extremes, render both, and count the pixels that move.
  //
  // That is the whole question. A breath a player cannot see is not a breath,
  // and one that moves a tenth of the animal is a bellows.
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
    const res = { err: null, rows: [], loaf: null }
    try {
      res.loaf = g.capy.loaf
      let hull = null
      g.capy.group.traverse(o => { if (o.name === 'capyHull') hull = o })
      if (!hull) throw new Error('no capyHull')
      const sq = hull.parent                      // capySquash: the writer's node
      const W = 900, H = 560
      g.renderer.setSize(W, H, false)
      const my = (g.capy.model || g.capy.group).rotation.y, p = g.capy.position

      // The two cameras that matter: the review sheet's three-quarter at 3 m,
      // and the frame the game actually spends its time in.
      const cams = []
      {
        const yaw = my + 0.75, d = 3.0
        const ay = p.y + 0.25
        const c = new T.PerspectiveCamera(32, W / H, 0.02, 900)
        c.position.set(p.x + Math.sin(my) * 0.1 + Math.sin(yaw) * d, ay + 0.75,
                       p.z + Math.cos(my) * 0.1 + Math.cos(yaw) * d)
        c.lookAt(p.x + Math.sin(my) * 0.1, ay, p.z + Math.cos(my) * 0.1)
        c.updateMatrixWorld()
        cams.push(['ar3q', c])
      }
      cams.push(['lens', g.camera])

      const grab = (c) => {
        g.renderer.render(g.scene, c)
        const t = document.createElement('canvas')
        t.width = W; t.height = H
        t.getContext('2d').drawImage(g.renderer.domElement, 0, 0)
        return t.getContext('2d').getImageData(0, 0, W, H).data
      }
      const wasX = sq.scale.x, wasY = sq.scale.y, wasZ = sq.scale.z
      // The candidates, as the y amplitude. 0.010 is the hand-off's; 0.0182 is
      // what R2's hull term worked out to at the top of the back (26.8 mm peak
      // to peak over a vertex 0.735 up); 0.016 is the hand-off's loaf value.
      for (const amp of [0.006, 0.010, 0.016, 0.0182, 0.026]) {
        const row = { amp, views: {} }
        for (const [name, c] of cams) {
          const set = (s) => {
            sq.scale.set(wasX + s * 0.6, wasY + s, wasZ + s * 0.6)
            sq.updateWorldMatrix(true, true)
          }
          set(amp); const A = grab(c)
          set(-amp); const B = grab(c)
          let n = 0, d = 0
          for (let i = 0; i < A.length; i += 4) {
            const la = 0.299 * A[i] + 0.587 * A[i + 1] + 0.114 * A[i + 2]
            const lb = 0.299 * B[i] + 0.587 * B[i + 1] + 0.114 * B[i + 2]
            const q = Math.abs(la - lb)
            if (q < 2) continue
            n++; d += q
          }
          row.views[name] = { px: n, meanDelta: n ? Math.round(d / n * 10) / 10 : 0 }
        }
        res.rows.push(row)
      }
      sq.scale.set(wasX, wasY, wasZ)
      sq.updateWorldMatrix(true, true)

      // ...and the size of the subject in each frame, so the pixel counts mean
      // something: how many pixels the animal covers at all.
      for (const [name, c] of cams) {
        const A = grab(c)
        g.capy.group.visible = false
        const B = grab(c)
        g.capy.group.visible = true
        let n = 0
        for (let i = 0; i < A.length; i += 4) {
          if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) +
              Math.abs(A[i + 2] - B[i + 2]) > 6) n++
        }
        res['subject_' + name] = n
      }
    } catch (e) { res.err = String((e && e.stack) || e) }
    return res
  })

  out.errs = errs
  await page.evaluate(async o => {
    await fetch('/shot?name=R5-see.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
