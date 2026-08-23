async page => {
  await page.reload()
  await page.waitForTimeout(4500)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const e = g.camera.matrixWorld.elements
    const rx = e[0], rz = e[2]
    const c = g.capy.position
    const P = (dx, dy, dz) => g.hud.audioProbe(c.x + dx, c.y + dy, c.z + dz)
    const r = {}
    r.atFeet   = P(0, 0, 0)
    r.right14  = P(rx * 14, 0, rz * 14)
    r.left14   = P(-rx * 14, 0, -rz * 14)
    r.ahead30  = P(-rz * 30, 0, rx * 30)
    r.d40      = P(rx * 40, 0, rz * 40)
    r.d90      = P(rx * 90, 0, rz * 90)
    r.d139     = P(rx * 139, 0, rz * 139)
    r.d400     = P(400, 0, 0)
    return r
  })
  const payload = JSON.stringify(out)
  await page.evaluate(async (b) => {
    await fetch('/shot?name=gp-audio2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(b))) })
  }, payload)
}
