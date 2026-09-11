async page => {
  // THE FOOT PLANTS (L3, E2): walk for three seconds and sample the lift of
  // leg 0 per frame; the share of frames with lift < 0.05 should be about the
  // stance share (0.6), and the shin should shorten in the swing.
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(6000)
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(1200)
  const r = await page.evaluate(() => new Promise((res) => {
    const g = window.__capy
    const rows = []; const t0 = performance.now()
    ;(function step() {
      const a = g.capy.animAudit()
      rows.push([+a.legLift[0].toFixed(2), +a.shin0.toFixed(3), +a.speed.toFixed(1)])
      if (performance.now() - t0 < 2500) requestAnimationFrame(step)
      else {
        const down = rows.filter(r => r[0] < 0.05).length
        const shinMin = Math.min(...rows.map(r => r[1]))
        res({ n: rows.length, downShare: +(down / rows.length).toFixed(2), shinMin, speed: rows[rows.length - 1][2], sample: rows.slice(0, 40).map(r => r[0]), err: g.state.lastError || null })
      }
    })()
  }))
  await page.keyboard.up('KeyW')
  await page.screenshot({ path: 'qa/l3-gait.png' })
  await page.evaluate((o) => fetch('/shot?name=l3-gait.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), r)
}
