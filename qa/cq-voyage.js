async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.keyboard.press('Enter'); await page.waitForTimeout(1200); await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(() => { window.__capy.biome.switchTo('quay') })
  await page.waitForTimeout(2500)
  // stand at the helm and take it
  await page.evaluate(() => {
    const g = window.__capy, h = g.quay.boat.helm
    const b = g.capy.body
    b.position.set(h.x, h.y + 0.2, h.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.state.lastError = null
  })
  await page.waitForTimeout(1200)
  await page.keyboard.press('e')
  await page.waitForTimeout(600)
  const log = []
  const snap = async (tag) => {
    log.push(Object.assign({ tag }, await page.evaluate(() => {
      const g = window.__capy, q = g.quay
      return { t: +g.state.time.toFixed(1), x: Math.round(q.boat.position.x),
               z: Math.round(q.boat.position.z), sp: +q.boat.speed.toFixed(1),
               helm: q.boat.atHelm, prog: +q.voyageProgress().toFixed(2),
               arrived: q.arrived(), fw: Math.round(q.freshwaterRange()),
               done: (g.tasks||[]).filter ? null : null,
               err: g.state.lastError || null }
    })))
  }
  await snap('helm')
  // full ahead, steering north with occasional corrections toward Manly
  await page.keyboard.down('w')
  await page.waitForTimeout(2600)
  await page.keyboard.up('w')
  for (let k = 0; k < 44; k++) {
    const st = await page.evaluate(() => {
      const g = window.__capy, q = g.quay
      const tx = 118, tz = -556
      const dx = tx - q.boat.position.x, dz = tz - q.boat.position.z
      let want = Math.atan2(dx, dz)
      let d = want - q.boat.heading
      while (d > Math.PI) d -= Math.PI*2
      while (d < -Math.PI) d += Math.PI*2
      return { d, dist: Math.hypot(dx, dz), sp: q.boat.speed }
    })
    if (st.d > 0.06) { await page.keyboard.down('a'); await page.waitForTimeout(220); await page.keyboard.up('a') }
    else if (st.d < -0.06) { await page.keyboard.down('d'); await page.waitForTimeout(220); await page.keyboard.up('d') }
    else await page.waitForTimeout(220)
    if (k === 4 || k === 9) await page.keyboard.press('q')     // horn: bridge + ferry
    if (st.dist < 60) { await page.keyboard.down('s'); await page.waitForTimeout(1400); await page.keyboard.up('s') }
    await page.waitForTimeout(1400)
    if (k % 6 === 0) await snap('leg' + k)
    if (st.dist < 34) break
  }
  await page.waitForTimeout(4000)
  await snap('arr')
  const tasks = await page.evaluate(() => {
    const g = window.__capy
    const li = [...document.querySelectorAll('#todo li, #card li, li')]
    const done = li.filter(e => e.className.indexOf('done') >= 0).map(e => e.textContent.trim())
    return { score: g.state.score, done, err: g.state.lastError || null,
             bodies: g.world.bodies.length, chips: !!(g.quay && g.quay.arrived()) }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=cq-voyage.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, { log, tasks })
}
