async page => {
  await page.reload()
  await page.waitForTimeout(4800)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)
  await page.evaluate(() => {
    const g = window.__capy
    window.__s = []
    window.__t = 0
    window.__iv = setInterval(function () {
      window.__t += 0.05
      window.__s.push({ t: Math.round(window.__t * 100) / 100,
        rest: Math.round(g.camInfo.rest * 1000) / 1000,
        pitch: Math.round(g.camInfo.pitch * 1800 / Math.PI) / 10,
        x: g.camera.position.x, y: g.camera.position.y, z: g.camera.position.z })
    }, 50)
  })
  await page.waitForTimeout(2500)
  await page.evaluate(() => { window.__mark = window.__s.length })
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(2500)
  await page.keyboard.up('KeyW')
  const out = await page.evaluate(() => {
    clearInterval(window.__iv)
    const s = window.__s, m = window.__mark
    const still = s.slice(2, m)
    let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9, mnz = 1e9, mxz = -1e9
    for (const r of still) {
      if (r.x < mnx) mnx = r.x
      if (r.x > mxx) mxx = r.x
      if (r.y < mny) mny = r.y
      if (r.y > mxy) mxy = r.y
      if (r.z < mnz) mnz = r.z
      if (r.z > mxz) mxz = r.z
    }
    const after = s.slice(m)
    let closed = null
    for (const r of after) if (closed === null && r.rest < 0.05) closed = Math.round((r.t - after[0].t) * 100) / 100
    return { n: s.length, mark: m,
             restAtRest: still.length ? still[still.length - 1].rest : null,
             pitchAtRest: still.length ? still[still.length - 1].pitch : null,
             breathX: Math.round((mxx - mnx) * 1000) / 1000,
             breathY: Math.round((mxy - mny) * 1000) / 1000,
             breathZ: Math.round((mxz - mnz) * 1000) / 1000,
             closeSecs: closed,
             pitchAfter: after.length ? after[after.length - 1].pitch : null }
  })
  await page.evaluate(o => fetch('/shot?name=vz-release.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
  await page.waitForTimeout(300)
}
