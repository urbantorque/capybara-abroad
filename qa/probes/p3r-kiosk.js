async page => {
  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) })
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 160)))
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(800)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => { window.__capy.biome.switchTo('rio') })
  await page.waitForFunction(() => window.__capy.biome.current === 'rio', null, { timeout: 30000 })
  await page.waitForTimeout(4000)

  const out = { probes: [], errors: [] }
  out.pre = await page.evaluate(() => ({
    done: window.__capy.taskDone('kiosk'),
    kioskPt: window.__capy.rio.kiosk,
    ky: window.__capy.rio.terrainHeight(-8, -8.4)
  }))

  // Probe from the SEA side (south, -z), on the ground, far to near.
  const zs = [-16.0, -14.0, -12.5, -12.0, -11.8, -11.5, -11.0, -10.5, -9.5]
  for (const z of zs) {
    const placed = await page.evaluate(async (zz) => {
      const g = window.__capy, b = g.capy.body
      const y = g.rio.terrainHeight(-8, zz)
      b.position.set(-8, y + 0.6, zz); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      return true
    }, z)
    await page.waitForTimeout(700)
    const before = await page.evaluate(() => ({
      y: +window.__capy.capy.position.y.toFixed(2),
      z: +window.__capy.capy.position.z.toFixed(2),
      gy: +window.__capy.rio.terrainHeight(window.__capy.capy.position.x, window.__capy.capy.position.z).toFixed(2)
    }))
    await page.keyboard.press('KeyE')
    await page.waitForTimeout(500)
    const done = await page.evaluate(() => window.__capy.taskDone('kiosk'))
    const d = Math.hypot(0, before.z - (-8.4))
    out.probes.push({ z: before.z, y: before.y, gy: before.gy, aboveGround: +(before.y - before.gy).toFixed(2), dist: +d.toFixed(2), done })
    if (done) break
  }
  // where the arrow points while the task is pending / after
  out.post = await page.evaluate(() => {
    const g = window.__capy
    const todo = document.querySelector('.capyui-todo')
    return {
      done: g.taskDone('kiosk'),
      cardText: todo ? (todo.innerText || '').replace(/\n/g, ' | ').slice(0, 400) : 'NO CARD'
    }
  })
  await page.screenshot({ path: 'qa/p3r-kiosk-after.png' })
  out.errors = errs.slice(0, 10)
  await page.evaluate(async o => {
    await fetch('/shot?name=p3r-kiosk.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
