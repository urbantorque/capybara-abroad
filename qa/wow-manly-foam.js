async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('BracketRight') // manly (14)
  await page.waitForTimeout(10000)
  const out = { errs, rows: [] }
  for (let i = 0; i < 8; i++) {
    const yaw = (i / 8) * Math.PI * 2
    const r = await page.evaluate(async (y) => {
      const g = window.__capy, T = g.THREE
      // aim at the break: the centroid of the foam field (the 150-instance
      // mesh at renderOrder 3), orbited at 22 m and 5 m up
      let fm = null
      g.scene.traverse(o => { if (o.isInstancedMesh && o.count === 150 && o.renderOrder === 3) fm = o })
      const m = new T.Matrix4(), v = new T.Vector3()
      const p = new T.Vector3()
      for (let k = 0; k < fm.count; k++) { fm.getMatrixAt(k, m); v.setFromMatrixPosition(m); p.add(v) }
      p.multiplyScalar(1 / fm.count)
      const cam = new T.PerspectiveCamera(34, 1280 / 760, 0.05, 400)
      cam.position.set(p.x + Math.sin(y) * 22, p.y + 5, p.z + Math.cos(y) * 22)
      cam.lookAt(p.x, p.y + 0.3, p.z); cam.updateMatrixWorld()
      const W = g.renderer.domElement.width, H = g.renderer.domElement.height
      const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
      const ctx = c2.getContext('2d', { willReadFrequently: true })
      const grab = () => { g.renderer.setRenderTarget(null); g.renderer.render(g.scene, cam); ctx.drawImage(g.renderer.domElement, 0, 0); return ctx.getImageData(0, 0, W, H).data }
      const two = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)))
      const diff = (a, b) => { let moved = 0, sum = 0; const n = W * H; for (let i2 = 0; i2 < n; i2++) { const j = i2 * 4; const d = Math.max(Math.abs(a[j] - b[j]), Math.abs(a[j + 1] - b[j + 1]), Math.abs(a[j + 2] - b[j + 2])); sum += d; if (d > 6) moved++ } return { movedPct: +(100 * moved / n).toFixed(3), meanDiff: +(sum / n).toFixed(3) } }
      // control: two frames apart, nothing cut — the foam's own intended motion
      g.state.noLeaf = false
      const c0 = grab(); await two(); const c1 = grab()
      const control = diff(c0, c1)
      // the cut: the leaf uniform is written once a frame by systems.js
      const a = grab(); const aUrl = g.renderer.domElement.toDataURL('image/png')
      g.state.noLeaf = true; await two()
      const b = grab()
      g.state.noLeaf = false; await two()
      const cut = diff(a, b)
      // excess: pixels the cut changed that the foam's own motion did not
      let excess = 0, exSum = 0
      { const n = W * H; for (let i2 = 0; i2 < n; i2++) { const j = i2 * 4
          const dc = Math.max(Math.abs(a[j] - b[j]), Math.abs(a[j + 1] - b[j + 1]), Math.abs(a[j + 2] - b[j + 2]))
          const dm = Math.max(Math.abs(c0[j] - c1[j]), Math.abs(c0[j + 1] - c1[j + 1]), Math.abs(c0[j + 2] - c1[j + 2]))
          if (dc > 6 && dm <= 6) { excess++; exSum += dc } } }
      if (y === 0 || Math.abs(y - Math.PI) < 0.01) await fetch('/shot?name=wow-manly-foam-' + (y === 0 ? '0' : 'pi'), { method: 'POST', body: aUrl })
      return { yaw: +y.toFixed(2), cut, control, excessPx: excess, excessMean: excess ? +(exSum / excess).toFixed(1) : 0 }
    }, yaw)
    out.rows.push(r)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wow-manly-foam.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
