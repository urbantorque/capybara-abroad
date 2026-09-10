async page => {
  // rd-blocked.js — the latch, in the place it was built for and in the
  // nineteen it must not touch.
  //
  // Two questions. Does a spot that cuts the boom stop asking for the wide
  // shot (and end up at the DRIVING lens rather than at a close-up of the
  // animal's head), and does it OSCILLATE — which is what the obvious version
  // of this fix does, on about a five second cycle.
  const shot = async (name) => {
    const b = await page.screenshot({ type: 'png' })
    await page.evaluate(async (o) => {
      await fetch('/shot?name=' + o.n, { method: 'POST', body: o.b })
    }, { n: name, b: b.toString('base64') })
  }
  const out = {}
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(2500)
  out.started = await page.evaluate(() => window.__capy.state.started)

  const read = () => page.evaluate(() => {
    const g = window.__capy
    const cam = g.camera
    cam.updateMatrixWorld(true)
    const fwd = new g.THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
    const p = g.capy.position
    const v = new g.THREE.Vector3(p.x, p.y + 0.35, p.z).project(cam)
    return { pitch: +(Math.asin(-fwd.y) * 180 / Math.PI).toFixed(1),
             rest: +(g.camInfo.rest || 0).toFixed(3),
             clear: +(g.camInfo.clear || 1).toFixed(3),
             dist: +(g.camInfo.dist || 0).toFixed(2),
             onScreen: Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z < 1,
             fromTop: +((1 - v.y) / 2).toFixed(2) }
  })

  // ---- 1. the Quay, parked where the ferry cuts the boom ------------------
  await page.evaluate(() => { window.__capy.hud.cross('quay') })
  await page.waitForTimeout(8000)
  // Walk into the tight spot rather than teleporting into it: a teleport is
  // motion and the bank would be draining for seconds afterwards.
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(2400)
  await page.keyboard.up('KeyW')
  // Sample across 24 s, which is four periods of the oscillation the scaled
  // version of this fix produces. A latch has to be flat here.
  out.quay = []
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(1000)
    out.quay.push(await read())
  }
  await shot('blocked-quay')

  // ---- 2. an open chapter, which must be untouched -----------------------
  await page.evaluate(() => { window.__capy.hud.cross('pasto') })
  await page.waitForTimeout(8000)
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(2400)
  await page.keyboard.up('KeyW')
  out.pasto = []
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(1000)
    out.pasto.push(await read())
  }
  await shot('blocked-pasto')

  await page.evaluate(async (o) => {
    await fetch('/shot?name=rd-blocked.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
