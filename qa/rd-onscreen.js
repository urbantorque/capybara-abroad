async page => {
  // rd-onscreen.js — THE GATE. A wider settled lens is worth nothing if it
  // takes the animal out of the picture, and the crane's own comment promises
  // it never does. Nineteen chapters, walking and settled: project the
  // capybara to NDC and report where in the frame it sits.
  //
  // Vector3.project() needs updateMatrixWorld(true) first or it reads a stale
  // matrix and puts everything off screen — that trap has bitten this repo
  // before and it reads exactly like the bug it is testing for.
  const out = { rows: [] }
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
    const p = g.capy.position
    const v = new g.THREE.Vector3(p.x, p.y + 0.35, p.z).project(cam)
    const fwd = new g.THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
    const pitch = Math.asin(-fwd.y)
    const halfV = (cam.fov * Math.PI / 180) / 2
    return { ndx: +v.x.toFixed(3), ndy: +v.y.toFixed(3), ndz: +v.z.toFixed(3),
             // 0 = top of frame, 1 = bottom, so a human can read it
             fromTop: +((1 - v.y) / 2).toFixed(3),
             onScreen: Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z < 1,
             pitch: +(pitch * 180 / Math.PI).toFixed(1),
             hor: +(Math.tan(pitch) / Math.tan(halfV)).toFixed(2),
             rest: +(g.camInfo.rest || 0).toFixed(2),
             dist: +(g.camInfo.dist || 0).toFixed(2),
             clear: +(g.camInfo.clear || 1).toFixed(2),
             lift2: +(g.camInfo.lift2 || 0).toFixed(2) }
  }

  const list = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  for (const b of list) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(8000)
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(2600)
    const walk = await page.evaluate(probe)
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(11000)
    const rest = await page.evaluate(probe)
    out.rows.push({ cur: await page.evaluate(() => window.__capy.biome.current), walk, rest })
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rd-onscreen.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
