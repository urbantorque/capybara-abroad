async page => {
  const state = async () => page.evaluate(() => {
    const g = window.__capy
    const p = g.capy.body.position
    const cam = g.camera
    const cq = cam.quaternion; const f = { x: -(2 * (cq.x * cq.z + cq.w * cq.y)), z: -(1 - 2 * (cq.x * cq.x + cq.y * cq.y)) }
    const q = g.capy.body.quaternion
    // capy forward: assume +z local? report both x/z of the body quaternion applied to (0,0,1)
    const fz = { x: 2 * (q.x * q.z + q.w * q.y), z: 1 - 2 * (q.x * q.x + q.y * q.y) }
    return { pos: [p.x, p.y, p.z].map(v => +v.toFixed(2)), camFwd: [f.x, f.z].map(v => +v.toFixed(2)), capyFwd: [fz.x, fz.z].map(v => +v.toFixed(2)) }
  })
  const log = []
  log.push(['before', await state()])
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1000); await page.keyboard.up('KeyW')
  await page.waitForTimeout(200)
  log.push(['after W 1s', await state()])
  await page.keyboard.down('KeyA'); await page.waitForTimeout(700); await page.keyboard.up('KeyA')
  await page.waitForTimeout(200)
  log.push(['after A 0.7s', await state()])
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1000); await page.keyboard.up('KeyW')
  await page.waitForTimeout(200)
  log.push(['after W 1s', await state()])
  await page.screenshot({ path: 'qa/l7r-play-26.png' })
  await page.evaluate((o) => fetch('/shot?name=l7r-play-s15.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), log)
}
