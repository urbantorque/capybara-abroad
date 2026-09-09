async page => {
  const KEYS = ['Digit1', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit8', 'Digit0', 'Minus']
  const rows = []
  for (let i = 0; i < KEYS.length; i++) {
    await page.reload()
    await page.waitForTimeout(4800)
    await page.keyboard.press(KEYS[i])
    await page.waitForTimeout(7500)
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(1600)
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(6500)
    const r = await page.evaluate(k => {
      const g = window.__capy, T = window.THREE || g.THREE
      let bg = null
      g.scene.traverse(function (o) {
        if (o.isGroup && o.children.length === 2 && o.children[0].geometry &&
            o.children[0].geometry.type === 'CylinderGeometry' &&
            o.children[1].geometry && o.children[1].geometry.type === 'CylinderGeometry' &&
            Math.abs(o.children[0].geometry.parameters.radiusTop - 0.85) < 1e-6) bg = o
      })
      const out = { key: k, biome: g.biome && g.biome.current, found: !!bg }
      if (bg) {
        g.camera.updateMatrixWorld(true)
        out.on = !!bg.visible
        const p = g.capy.group.position
        out.d = Math.round(Math.hypot(bg.position.x - p.x, bg.position.z - p.z) * 10) / 10
        const v = new (bg.position.constructor)(bg.position.x, bg.position.y + 3, bg.position.z)
        v.project(g.camera)
        out.ndc = { x: Math.round(v.x * 100) / 100, y: Math.round(v.y * 100) / 100,
                    z: Math.round(v.z * 1000) / 1000 }
        out.inFrame = v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1
      }
      out.pitch = Math.round(g.camInfo.pitch * 1800 / Math.PI) / 10
      out.rest = Math.round(g.camInfo.rest * 100) / 100
      return out
    }, KEYS[i])
    rows.push(r)
  }
  await page.evaluate(o => fetch('/shot?name=vz-beacon-before.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), rows)
  await page.waitForTimeout(500)
}
