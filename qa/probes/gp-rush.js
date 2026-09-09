async page => {
  await page.reload()
  await page.waitForTimeout(4500)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1200)
  await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('kowloon')
    await new Promise(r => setTimeout(r, 600))
  })
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW')
  const res = await page.evaluate(async () => {
    const g = window.__capy
    const L = g.locals.filter(x => x.biome === 'kowloon')[0]
    if (!L) return { skip: true }
    // let it get up to speed and settle on a heading first
    await new Promise(r => setTimeout(r, 900))
    const p = g.capy.position, v = g.capy.velocity
    const sp = Math.hypot(v.x, v.z) || 1
    // drop the person 5 m straight down the animal's actual line of travel
    L.x = p.x + v.x / sp * 5
    L.z = p.z + v.z / sp * 5
    if (L.group) L.group.position.set(L.x, L.group.position.y, L.z)
    if (L.body) { L.body.position.set(L.x, L.body.position.y, L.z)
                  L.body.previousPosition.copy(L.body.position)
                  L.body.interpolatedPosition.copy(L.body.position) }
    L.anchor.group.position.set(L.x, (L.y || 0) + 1.35, L.z)
    L.cd = 0; L.fl = 0; L.flV = 0; L.last = ''; L.rushWas = false; L.was = true
    let peak = 0, maxSp = 0, minD = 999, said = ''
    const t0 = performance.now()
    while (performance.now() - t0 < 2200) {
      await new Promise(r => requestAnimationFrame(r))
      const q = g.capy.position, w = g.capy.velocity
      const s2 = Math.hypot(w.x, w.z)
      if (s2 > maxSp) maxSp = s2
      const d = Math.hypot(q.x - L.x, q.z - L.z)
      if (d < minD) minD = d
      if (L.fl < peak) peak = L.fl
      if (L.last) said = L.last
    }
    return { peak: +peak.toFixed(3), maxSp: +maxSp.toFixed(2), minD: +minD.toFixed(2), said }
  })
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft')
  const payload = JSON.stringify(res)
  await page.evaluate(async (b) => {
    await fetch('/shot?name=gp-rush.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(b))) })
  }, payload)
}
