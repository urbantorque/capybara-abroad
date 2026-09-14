async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6500)
  const out = { started: null }
  out.started = await page.evaluate(() => window.__capy && window.__capy.state && window.__capy.state.started)
  await page.evaluate(() => window.__capy.hud.cross('kowloon'))
  await page.waitForTimeout(9000)
  await page.keyboard.down('KeyW'); await page.waitForTimeout(3200); await page.keyboard.up('KeyW')
  await page.waitForTimeout(14000)
  // THE PANES (L7, E4 / art #6): every box of the lit-pane mesh (the unlit
  // vertexColors mesh whose bounds sit on the street, not the far shore),
  // merged into panes where boxes stack, projected as the face nearest the
  // lens, sampled on a grid. The luma sd per pane is read off the PNG by
  // qa/l7-e4-panes.mjs.
  out.hk = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const root = g.scene.getObjectByName('kowloon')
    let lm = null
    root.traverse(o => {
      if (!o.isMesh || !o.material || !o.material.isMeshBasicMaterial || !o.material.vertexColors) return
      o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox
      if (bb.max.z < -100) return           // the far shore
      if (bb.max.y > 60) return             // the towers' windows
      if (!lm || o.geometry.attributes.position.count > lm.geometry.attributes.position.count) lm = o
    })
    if (!lm) return { err: 'no pane mesh' }
    const pa = lm.geometry.attributes.position
    const boxes = []
    for (let i = 0; i + 24 <= pa.count; i += 24) {
      const b = new T.Box3()
      for (let k = 0; k < 24; k++) b.expandByPoint(new T.Vector3(pa.getX(i + k), pa.getY(i + k), pa.getZ(i + k)))
      boxes.push(b)
    }
    // merge stacked bands into panes: same x/z extents (±2 cm), touching in y
    const panes = []
    for (const b of boxes) {
      let hit = null
      for (const p of panes) {
        if (Math.abs(p.min.x - b.min.x) < 0.02 && Math.abs(p.max.x - b.max.x) < 0.02 && Math.abs(p.min.z - b.min.z) < 0.02 && Math.abs(p.max.z - b.max.z) < 0.02 &&
            (Math.abs(p.max.y - b.min.y) < 0.02 || Math.abs(p.min.y - b.max.y) < 0.02)) { hit = p; break }
      }
      if (hit) hit.union(b); else panes.push(b.clone())
    }
    const E = g.camera.position
    const proj = (x, y, z) => { const p = new T.Vector3(x, y, z).project(g.camera); return [(p.x + 1) * 0.5 * W, (1 - p.y) * 0.5 * H, p.z] }
    const rows = []
    for (const p of panes) {
      const sy = p.max.y - p.min.y
      if (sy < 0.6) continue
      const sx = p.max.x - p.min.x, sz = p.max.z - p.min.z
      let quad
      if (sx < sz) { const x = E.x < (p.min.x + p.max.x) * 0.5 ? p.min.x : p.max.x; quad = [[x, p.min.y, p.min.z], [x, p.min.y, p.max.z], [x, p.max.y, p.max.z], [x, p.max.y, p.min.z]] }
      else { const z = E.z < (p.min.z + p.max.z) * 0.5 ? p.min.z : p.max.z; quad = [[p.min.x, p.min.y, z], [p.max.x, p.min.y, z], [p.max.x, p.max.y, z], [p.min.x, p.max.y, z]] }
      const q = quad.map(c => proj(c[0], c[1], c[2]))
      if (q.some(c => c[2] > 1 || c[2] < -1 || c[0] < 0 || c[0] > W || c[1] < 0 || c[1] > H)) continue
      const hpx = Math.abs(q[2][1] - q[1][1])
      if (hpx < 30) continue
      // sample grid: bilinear in the quad, inset 8 % so the frame's mullion is not in it
      const pts = []
      for (let v = 0.08; v <= 0.92; v += 0.06) for (let u = 0.08; u <= 0.92; u += 0.1) {
        const ax = q[0][0] + (q[1][0] - q[0][0]) * u, ay = q[0][1] + (q[1][1] - q[0][1]) * u
        const bx = q[3][0] + (q[2][0] - q[3][0]) * u, by = q[3][1] + (q[2][1] - q[3][1]) * u
        pts.push([Math.round(ax + (bx - ax) * v), Math.round(ay + (by - ay) * v)])
      }
      const dist = Math.hypot((p.min.x + p.max.x) * 0.5 - E.x, (p.min.z + p.max.z) * 0.5 - E.z)
      rows.push({ at: [+((p.min.x + p.max.x) * 0.5).toFixed(1), +((p.min.y + p.max.y) * 0.5).toFixed(2), +((p.min.z + p.max.z) * 0.5).toFixed(1)], hpx: +hpx.toFixed(0), dist: +dist.toFixed(1), pts })
    }
    return { boxes: boxes.length, panes: panes.length, inFrame: rows.length, cam: E.toArray().map(v => +v.toFixed(2)), rows, err: g.state.lastError || null }
  })
  await page.screenshot({ path: 'qa/l7-e4-panes-hk.png' })
  await page.evaluate((o) => fetch('/shot?name=l7-e4-panes.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
