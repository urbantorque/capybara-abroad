async page => {
  // rd-sweep.js — all nineteen, at the settled lens, after the whole pass.
  // The picture the player is actually going to spend their time in, judged by
  // eye and measured by qa/pnghist.mjs on the same files.
  const shot = async (name) => {
    const b = await page.screenshot({ type: 'png' })
    await page.evaluate(async (o) => {
      await fetch('/shot?name=' + o.n, { method: 'POST', body: o.b })
    }, { n: name, b: b.toString('base64') })
  }
  const out = { rows: [] }
  const errs = []
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) })
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(2500)
  out.started = await page.evaluate(() => window.__capy.state.started)

  const list = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  for (let i = 0; i < list.length; i++) {
    const b = list[i]
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(8000)
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(2400)
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(11000)
    out.rows.push(await page.evaluate(() => {
      const g = window.__capy
      const cam = g.camera
      cam.updateMatrixWorld(true)
      const fwd = new g.THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
      const pitch = Math.asin(-fwd.y)
      const halfV = (cam.fov * Math.PI / 180) / 2
      const p = g.capy.position
      const v = new g.THREE.Vector3(p.x, p.y + 0.35, p.z).project(cam)
      return { cur: g.biome.current,
               pitch: +(pitch * 180 / Math.PI).toFixed(1),
               hor: +(Math.tan(pitch) / Math.tan(halfV)).toFixed(2),
               onScreen: Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z < 1,
               fromTop: +((1 - v.y) / 2).toFixed(2),
               rest: +(g.camInfo.rest || 0).toFixed(2),
               clear: +(g.camInfo.clear || 1).toFixed(2),
               err: g.state.lastError || null }
    }))
    await shot('sweep-' + String(i + 1).padStart(2, '0') + '-' + b)
  }
  out.errs = errs.slice(0, 20)
  out.errN = errs.length
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rd-sweep.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
