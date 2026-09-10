async page => {
  // rd-rest.js — the SETTLED frame in nine chapters, plus the walking frame in
  // the same spot, so a change to the two pitch numbers can be judged as a
  // pair of pictures rather than as a pair of numbers. Tag is a literal and is
  // rewritten between runs (run-code takes no argument — trap 14).
  const TAG = 'C'
  const shot = async (name) => {
    const b = await page.screenshot({ type: 'png' })
    await page.evaluate(async (o) => {
      await fetch('/shot?name=' + o.n, { method: 'POST', body: o.b })
    }, { n: name, b: b.toString('base64') })
  }
  const out = { tag: TAG, rows: [] }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(2500)
  out.started = await page.evaluate(() => window.__capy.state.started)

  const probe = () => {
    const g = window.__capy
    const cam = g.camera
    cam.updateMatrixWorld(true)
    const fwd = new g.THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
    const pitch = Math.asin(-fwd.y)
    const halfV = (cam.fov * Math.PI / 180) / 2
    const ci = g.camInfo
    return { st: g.state.started, pitch: +(pitch * 180 / Math.PI).toFixed(1),
             fov: +cam.fov.toFixed(1),
             hor: +(Math.tan(pitch) / Math.tan(halfV)).toFixed(2),
             rest: +(ci.rest || 0).toFixed(3), dist: +(ci.dist || 0).toFixed(2),
             reach: +(ci.reach || 0).toFixed(2), clear: +(ci.clear || 1).toFixed(3),
             lift: +(ci.lift || 0).toFixed(2), lift2: +(ci.lift2 || 0).toFixed(2) }
  }

  const list = ['sydney', 'pasto', 'kyoto', 'rio', 'iceland', 'venice',
                'kowloon', 'goreme', 'antarctic', 'monaco', 'hanoi', 'pantanal']
  for (const b of list) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(8000)
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(2600)
    const walk = await page.evaluate(probe)
    await shot('rest-' + TAG + '-walk-' + b)
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(11000)
    const rest = await page.evaluate(probe)
    await shot('rest-' + TAG + '-still-' + b)
    out.rows.push({ b, cur: await page.evaluate(() => window.__capy.biome.current), walk, rest })
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rd-rest-' + o.tag + '.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
