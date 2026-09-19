async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit2')
  await page.waitForTimeout(10000)
  const r = await page.evaluate(async () => {
    const g = window.__capy
    let fm = null
    g.scene.traverse(o => { if (o.name === 'pastoBuntingFlags') fm = o })
    if (!fm) return { none: true }
    const cam = g.camera.clone(); cam.updateMatrixWorld()
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
    const ctx = c2.getContext('2d', { willReadFrequently: true })
    const grab = () => {
      g.state.shadowDirty = true
      g.renderer.shadowMap.needsUpdate = true
      g.renderer.setRenderTarget(null)
      g.renderer.render(g.scene, cam)
      ctx.drawImage(g.renderer.domElement, 0, 0)
      return ctx.getImageData(0, 0, W, H).data
    }
    fm.castShadow = true
    const a = grab()
    const aUrl = g.renderer.domElement.toDataURL('image/png')
    fm.castShadow = false
    const b = grab()
    fm.castShadow = true
    let moved = 0, sum = 0, maxD = 0
    const n = W * H
    const img = ctx.createImageData(W, H)
    for (let i = 0; i < n; i++) {
      const j = i * 4
      const d = Math.max(Math.abs(a[j] - b[j]), Math.abs(a[j + 1] - b[j + 1]), Math.abs(a[j + 2] - b[j + 2]))
      sum += d; if (d > 6) moved++; if (d > maxD) maxD = d
      const v = Math.min(255, d * 6)
      img.data[j] = v; img.data[j + 1] = v; img.data[j + 2] = v; img.data[j + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    await fetch('/shot?name=wow-pasto-flags-on', { method: 'POST', body: aUrl })
    await fetch('/shot?name=wow-pasto-flags-diff', { method: 'POST', body: c2.toDataURL('image/png') })
    return { maxD, tris: fm.geometry.index ? fm.geometry.index.count / 3 : fm.geometry.attributes.position.count / 3, movedPct: +(100 * moved / n).toFixed(3), meanDiff: +(sum / n).toFixed(3), shadowType: g.renderer.shadowMap.type, autoUpdate: g.renderer.shadowMap.autoUpdate }
  })
  r.errs = errs
  await page.evaluate(async (o) => { await fetch('/shot?name=wow-pasto-flags.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, r)
}
