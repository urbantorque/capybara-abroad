async page => {
  const out = { rows: [], errs: [] }
  page.on('console', m => { if (m.type() === 'error') out.errs.push(String(m.text()).slice(0, 200)) })
  page.on('pageerror', e => { out.errs.push('PAGEERROR ' + String(e.message).slice(0, 200)) })
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(2500)

  const list = ['sydney', 'pasto', 'quay', 'cali', 'rio', 'sahara', 'venice',
                'palawan', 'manly', 'pantanal', 'antarctic', 'hanoi', 'kyoto',
                'iceland', 'kowloon', 'monaco', 'goreme', 'cave', 'drift']
  for (let i = 0; i < list.length; i++) {
    const b = list[i]
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(7000)
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(2000)
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(8000)
    const tag = String(i + 1).padStart(2, '0')
    await page.screenshot({ path: 'qa/m1-' + tag + '-' + b + '.png' })
    const row = await page.evaluate(() => {
      const g = window.__capy
      let found = null
      g.scene.traverse(function (o) {
        if (o.isInstancedMesh && o.renderOrder === -19) found = o
      })
      if (!found) return { cur: g.biome.current, mesh: false }
      // Count instances with a non-zero scale, off the matrices themselves —
      // a table saying how many there should be is not evidence (trap 39).
      const m = new g.THREE.Matrix4()
      const s = new g.THREE.Vector3()
      const p = new g.THREE.Vector3()
      const q = new g.THREE.Quaternion()
      let live = 0, minEl = 999, maxEl = -999, minW = 1e9, maxW = 0
      for (let i = 0; i < found.count; i++) {
        found.getMatrixAt(i, m)
        m.decompose(p, q, s)
        if (s.x < 0.001) continue
        live++
        const el = Math.atan2(p.y, Math.hypot(p.x, p.z)) * 180 / Math.PI
        if (el < minEl) minEl = el
        if (el > maxEl) maxEl = el
        const d = p.length()
        if (d < minW) minW = d
        if (d > maxW) maxW = d
      }
      return { cur: g.biome.current, mesh: true, visible: found.visible,
               live: live, cap: found.count,
               parent: found.parent === g.scene ? 'scene' : 'dome',
               minEl: +minEl.toFixed(1), maxEl: +maxEl.toFixed(1),
               minD: +minW.toFixed(0), maxD: +maxW.toFixed(0),
               spin: +(found.rotation.y).toFixed(3),
               calls: g.renderer.info.render.calls,
               lastError: g.state.lastError ? String(g.state.lastError).slice(0, 140) : null }
    })
    out.rows.push(row)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=m1-sky.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
