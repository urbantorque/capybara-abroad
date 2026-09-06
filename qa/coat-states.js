async page => {
  // R1's OTHER THREE STATES. The coat is a buffer, and three things in this
  // file swap what reads it: the soak swaps every mesh to its wet twin, the
  // wardrobe puts an unpainted `mat()` mesh over a painted one, and the ghost
  // rebakes the animal from its geometry. Each is a way for the change to
  // render black, lose the gradient, or take a costume with it — and none of
  // the three is visible in the dry, bare, unbaked frame the coat probe shoots.
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
    const res = { err: null, states: {} }
    try {
      const W = 1280, H = 760
      g.renderer.setSize(W, H, false)
      const p = g.capy.position
      const my = (g.capy.model || g.capy.group).rotation.y
      const rc = document.createElement('canvas')
      rc.width = W; rc.height = H
      const rx = rc.getContext('2d', { willReadFrequently: true })

      function shoot(yawOff, dist, up, aimY, fov) {
        const ay = p.y + (aimY || 0), yaw = my + yawOff
        const c = new T.PerspectiveCamera(fov || 26, W / H, 0.05, 400)
        c.position.set(p.x + Math.sin(yaw) * dist, ay + up, p.z + Math.cos(yaw) * dist)
        c.lookAt(p.x, ay, p.z); c.updateMatrixWorld()
        g.renderer.setRenderTarget(null)
        g.renderer.render(g.scene, c)
        const dom = g.renderer.domElement
        const png = dom.toDataURL('image/png')
        rx.clearRect(0, 0, W, H); rx.drawImage(dom, 0, 0, W, H)
        return { png, d: rx.getImageData(0, 0, W, H).data }
      }
      // The one number that catches the failure mode: how much of the animal
      // came out BLACK. A `vertexColors` material on a mesh with no colour
      // attribute is not a warning, it is a black mesh.
      function darkFrac(d) {
        let n = 0, dark = 0
        for (let y = 260; y < 700; y += 2) for (let x = 380; x < 900; x += 2) {
          const i = (y * W + x) * 4
          const L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
          n++; if (L < 24) dark++
        }
        return Math.round(dark / n * 10000) / 10000
      }
      // ...and one that catches the opposite: a coat that quietly went flat.
      function span(d) {
        let lo = 255, hi = 0
        for (let y = 300; y < 640; y += 2) for (let x = 470; x < 860; x += 2) {
          const i = (y * W + x) * 4
          const L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
          if (L < lo) lo = L
          if (L > hi) hi = L
        }
        return [Math.round(lo), Math.round(hi)]
      }

      async function grab(name) {
        const f = shoot(Math.PI * 0.82, 3.40, 1.55, 0.10, 26)
        res.states[name] = { dark: darkFrac(f.d), span: span(f.d) }
        await fetch('/shot?name=R1s-' + name, { method: 'POST', body: f.png })
      }

      await grab('dry')

      // ---- THE SOAK, checked STRUCTURALLY and not with a picture. The wet
      // level is module-private and there is no hook to force it — but the
      // swap only ever writes `mesh.material`, never the geometry, so the
      // question is exactly "does every twin carry vertexColors", which
      // coatAudit answers for all six at once. A render of a wet animal would
      // be a weaker test than that, not a stronger one.

      // ---- THE WARDROBE. Costume meshes are on mat() and must NOT be painted.
      // NO TICK BETWEEN WEAR AND SHOOT. systems.js re-asserts the chapter's
      // earned costume every frame (systems.js `game.capy.wear(put)`), so a
      // tick after `wear` in Sydney puts the animal straight back in nothing —
      // which reads as "wear is broken" and is the costume system working.
      g.capy.wear('parka')
      await grab('parka')
      g.capy.wear('black-tie')
      await grab('blacktie')
      g.capy.wear(null)

      // ---- THE GHOST. Baked from position + normal only; a colour attribute
      // on the source geometry must not reach it.
      g.capy.ghost.show(p.x, p.y, p.z, my, 1)
      res.ghostOn = g.capy.ghost.on()
      await grab('ghost')
      g.capy.ghost.hide()

      res.audit = g.capy.coatAudit()
      res.lastError = g.state && g.state.lastError ? String(g.state.lastError) : null
    } catch (e) { res.err = String((e && e.stack) || e) }
    return res
  })
  out.errs = errs
  await page.evaluate(async o => {
    await fetch('/shot?name=R1s-result.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
