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
    const res = { err: null, parts: {}, errs: [] }
    try {
      const W = 960, H = 560
      g.renderer.setSize(W, H, false)
      const rc = document.createElement('canvas'); rc.width = W; rc.height = H
      const rx = rc.getContext('2d', { willReadFrequently: true })
      const my = (g.capy.model || g.capy.group).rotation.y
      const p = g.capy.position
      const aim = new T.Vector3(p.x, p.y + 0.16, p.z)
      // six bearings, because a lapel that only shows from dead ahead is not a
      // dead part and a probe with one camera cannot tell the two apart
      const VIEWS = [[0.0, 2.4, 0.75], [0.33, 2.4, 0.75], [Math.PI * 0.5, 2.6, 0.55],
                     [Math.PI * 0.78, 2.6, 1.00], [Math.PI, 2.6, 0.85],
                     [-Math.PI * 0.45, 2.6, 0.60]]
      function frames() {
        const out = []
        for (const v of VIEWS) {
          const yaw = my + v[0]
          const c = new T.PerspectiveCamera(30, W / H, 0.02, 400)
          c.position.set(aim.x + Math.sin(yaw) * v[1], aim.y + v[2], aim.z + Math.cos(yaw) * v[1])
          c.lookAt(aim.x, aim.y, aim.z); c.updateMatrixWorld()
          g.renderer.setRenderTarget(null)
          g.renderer.render(g.scene, c)
          rx.clearRect(0, 0, W, H); rx.drawImage(g.renderer.domElement, 0, 0, W, H)
          out.push(rx.getImageData(0, 0, W, H).data)
        }
        return out
      }
      function diff(a, b) {
        let n = 0
        for (let k = 0; k < a.length; k++) {
          const x = a[k], y = b[k]
          for (let i = 0; i < x.length; i += 4) {
            if (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) +
                Math.abs(x[i + 2] - y[i + 2]) > 20) n++
          }
        }
        return n
      }
      // NO TICK between wear() and a render: systems.js re-asserts the chapter's
      // costume every frame, so one tick here photographs a naked animal.
      for (const id of ['black-tie', 'parka', 'plumes']) {
        g.capy.wear(id)
        const root = []
        g.capy.group.traverse(o => {
          if (o.isGroup && o.visible && o.children.length &&
              o.children.some(c => c.isMesh)) root.push(o)
        })
        const meshes = []
        g.capy.group.traverse(o => {
          if (!o.isMesh || !o.visible) return
          for (let q = o.parent; q && q !== g.capy.group; q = q.parent) if (!q.visible) return
          if (o.name === 'capyHull' || o.name === 'capyMuzzle' || o.name === 'capyPad') return
          meshes.push(o)
        })
        const base = frames()
        const bag = []
        for (let i = 0; i < meshes.length; i++) {
          const m = meshes[i]
          m.visible = false
          const n = diff(base, frames())
          m.visible = true
          bag.push([i, m.geometry.type, Math.round(m.position.x * 1000) / 1000,
                    Math.round(m.position.y * 1000) / 1000,
                    Math.round(m.position.z * 1000) / 1000, n])
        }
        res.parts[id] = bag.filter(r => r[5] < 60)
        res.parts[id + '_count'] = bag.length
      }
      g.capy.wear(null)
      res.lastError = g.state && g.state.lastError ? String(g.state.lastError) : null
    } catch (e) { res.err = String((e && e.stack) || e) }
    return res
  })
  out.errs = errs
  await page.evaluate(async o => {
    await fetch('/shot?name=R2p-result.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
