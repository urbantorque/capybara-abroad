async page => {
  await page.emulateMedia({ reducedMotion: null })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.keyboard.press('Digit0')
  await page.waitForTimeout(10000)
  const out = await page.evaluate(() => new Promise(function (done) {
    const g = window.__capy
    const dts = []
    let last = performance.now()
    let calls = 0, tris = 0, n = 0
    function step() {
      const t = performance.now()
      dts.push(t - last)
      last = t
      const info = g.renderer.info.render
      calls += info.calls; tris += info.triangles; n++
      if (dts.length < 600) requestAnimationFrame(step)
      else {
        dts.sort(function (a, b) { return a - b })
        done({ median: Math.round(dts[300] * 100) / 100,
               p95: Math.round(dts[570] * 100) / 100,
               frames: dts.length,
               calls: Math.round(calls / n), tris: Math.round(tris / n),
               rest: Math.round(g.camInfo.rest * 100) / 100,
               reach: Math.round(g.camInfo.reach * 10) / 10 })
      }
    }
    requestAnimationFrame(step)
  }))
  await page.evaluate(o => fetch('/shot?name=vz-perf.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
  await page.waitForTimeout(300)
}
