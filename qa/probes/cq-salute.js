async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.keyboard.press('Enter'); await page.waitForTimeout(1200)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => { window.__capy.biome.switchTo('quay') })
  await page.waitForTimeout(2000)
  const shot = async (n) => { await page.evaluate(async (nm) => {
      const g = window.__capy
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix()
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      await fetch('/shot?name=' + nm, { method:'POST', body: g.renderer.domElement.toDataURL('image/png') })
    }, n) }
  const out = {}
  await page.evaluate(() => {
    const g = window.__capy, h = g.quay.boat.helm, b = g.capy.body
    b.position.set(h.x, h.y + 0.2, h.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
  })
  await page.waitForTimeout(1200)
  await page.keyboard.press('KeyE')
  await page.waitForTimeout(500)
  await page.keyboard.down('w'); await page.waitForTimeout(2400); await page.keyboard.up('w')
  const TX = 136, TZ = -309
  for (let k = 0; k < 70; k++) {
    const st = await page.evaluate((t) => {
      const g = window.__capy, q = g.quay
      const dx = t[0] - q.boat.position.x, dz = t[1] - q.boat.position.z
      let d = Math.atan2(dx, dz) - q.boat.heading
      while (d > Math.PI) d -= Math.PI*2
      while (d < -Math.PI) d += Math.PI*2
      return { d, dist: Math.hypot(dx, dz) }
    }, [TX, TZ])
    if (st.dist < 26) break
    if (st.d > 0.05) { await page.keyboard.down('a'); await page.waitForTimeout(200); await page.keyboard.up('a') }
    else if (st.d < -0.05) { await page.keyboard.down('d'); await page.waitForTimeout(200); await page.keyboard.up('d') }
    else await page.waitForTimeout(200)
    await page.waitForTimeout(430)
  }
  await page.keyboard.down('s'); await page.waitForTimeout(2600); await page.keyboard.up('s')
  let r = 999
  for (let k = 0; k < 200 && r > 66; k++) {
    await page.waitForTimeout(900)
    r = await page.evaluate(() => window.__capy.quay.freshwaterRange())
  }
  out.range = Math.round(r)
  await page.keyboard.press('q')
  await page.waitForTimeout(800)
  await shot('CQ4-steam')
  await page.waitForTimeout(1500)
  await shot('CQ4-wave')
  out.mid = await page.evaluate(() => ({ err: window.__capy.state.lastError || null,
      score: window.__capy.state.score }))
  await page.waitForTimeout(10500)
  await shot('CQ4-wash')
  out.end = await page.evaluate(() => {
    const g = window.__capy
    const li = [...document.querySelectorAll('li')].filter(e => e.className.indexOf('done') >= 0)
    return { err: g.state.lastError || null, score: g.state.score,
             done: li.map(e => e.textContent.trim()) }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=cq-salute.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
