async page => {
  const KEYS = ['Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash']
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
      const g = window.__capy, c = g.camInfo
      const cam = g.camera
      const half = Math.atan(Math.tan(cam.fov * Math.PI / 360)) * 180 / Math.PI
      return { key: k, biome: g.biome && g.biome.current,
               pitch: Math.round(c.pitch * 1800 / Math.PI) / 10,
               reach: Math.round(c.reach * 10) / 10,
               rest: Math.round(c.rest * 100) / 100,
               clear: Math.round(c.clear * 100) / 100,
               lift2: Math.round(c.lift2 * 100) / 100,
               camY: Math.round(cam.position.y * 10) / 10,
               horizon: Math.round((c.pitch * 180 / Math.PI - half) * 10) / 10,
               err: (g.state && g.state.lastError) || null }
    }, KEYS[i])
    rows.push(r)
  }
  await page.evaluate(o => fetch('/shot?name=vz-sweepB.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), rows)
  await page.waitForTimeout(500)
}
