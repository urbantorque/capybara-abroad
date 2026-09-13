async page => {
  // A crop of the resting animal at the resting lens, and a count of the
  // catchlight's pixels: the picture the rest probe takes is a whole frame at
  // 1280 x 760 and the animal is 60 px/m in it. Run after qa/l6-body.js in
  // the same session, or after Begin on any fresh one.
  await page.evaluate(() => { const g = window.__capy; const b = g.capy.body; b.position.set(6, 0.5, 30); b.velocity.set(0, 0, 0) })
  await page.keyboard.down('KeyW'); await page.waitForTimeout(250); await page.keyboard.up('KeyW')
  await page.waitForTimeout(12000)
  const r = await page.evaluate(() => {
    const g = window.__capy
    const head = g.capy.group.getObjectByName('capyMuzzle').parent
    head.updateWorldMatrix(true, false)
    const e = head.matrixWorld.elements
    const v = { x: e[12], y: e[13], z: e[14] }
    const cam = g.camera; cam.updateMatrixWorld(true)
    // project by hand: world -> view -> clip
    const m = cam.matrixWorldInverse.elements, p = cam.projectionMatrix.elements
    const vx = m[0] * v.x + m[4] * v.y + m[8] * v.z + m[12], vy = m[1] * v.x + m[5] * v.y + m[9] * v.z + m[13], vz = m[2] * v.x + m[6] * v.y + m[10] * v.z + m[14]
    const cx = p[0] * vx + p[4] * vy + p[8] * vz + p[12], cy = p[1] * vx + p[5] * vy + p[9] * vz + p[13], cw = p[3] * vx + p[7] * vy + p[11] * vz + p[15]
    const nx = cx / cw, ny = cy / cw
    return { sx: (nx + 1) / 2 * innerWidth, sy: (1 - ny) / 2 * innerHeight, rest: g.camInfo.rest, dist: g.camInfo.dist, yaw: head.rotation.y, scale: head.scale.x }
  })
  const W = 320, H = 240
  const x = Math.max(0, Math.round(r.sx - W / 2)), y = Math.max(0, Math.round(r.sy - H / 2))
  await page.screenshot({ path: 'qa/l6-body-face.png', clip: { x, y, width: W, height: H } })
  // ...and the bright pixels near the head, straight off the canvas
  const px = await page.evaluate(({ sx, sy }) => {
    const c = document.querySelector('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl')
    if (!gl) return null
    const R = 24, w = R * 2, h = R * 2
    const buf = new Uint8Array(w * h * 4)
    const dx = c.width / innerWidth, dy = c.height / innerHeight
    gl.readPixels(Math.round(sx * dx - R), Math.round(c.height - sy * dy - R), w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf)
    let bright = 0, max = 0
    for (let i = 0; i < w * h; i++) { const l = 0.2126 * buf[i * 4] + 0.7152 * buf[i * 4 + 1] + 0.0722 * buf[i * 4 + 2]; if (l > max) max = l; if (l > 230) bright++ }
    return { bright, max: +max.toFixed(0), box: w * h }
  }, r)
  const out = Object.assign(r, { px })
  console.log(JSON.stringify(out))
  await page.evaluate((o) => fetch('/shot?name=l6-body-face.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
