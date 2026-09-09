async page => {
  await page.reload()
  await page.waitForTimeout(4500)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
  const res = await page.evaluate(async () => {
    const g = window.__capy
    const sample = (label, mag, ms) => new Promise(done => {
      const s = []
      const t0 = performance.now()
      g.punch(mag)
      const iv = setInterval(() => {
        s.push([+(performance.now() - t0).toFixed(0), +g.camera.fov.toFixed(2), +g.state.timeScale.toFixed(3)])
        if (performance.now() - t0 > ms) { clearInterval(iv); done({ label, s }) }
      }, 16)
    })
    const a = await sample('full-0.34', 0.34, 500)
    await new Promise(r => setTimeout(r, 900))
    const b = await sample('marquee-0.14', 0.14, 400)
    return { a, b, base: g.camera.fov }
  })
  const payload = JSON.stringify(res)
  await page.evaluate(async (b) => {
    await fetch('/shot?name=gp-punch.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(b))) })
  }, payload)
}
