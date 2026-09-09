async page => {
  await page.reload()
  await page.waitForTimeout(4800)
  await page.keyboard.press('Digit2')
  await page.waitForTimeout(9000)
  await page.evaluate(() => {
    const g = window.__capy
    window.__s = []
    window.__iv = setInterval(function () {
      const v = g.capy && g.capy.velocity
      const b = g.capy && g.capy.body && g.capy.body.velocity
      window.__s.push({
        cv: v ? Math.round(Math.hypot(v.x, v.z) * 100) / 100 : null,
        bv: b ? Math.round(Math.hypot(b.x, b.z) * 100) / 100 : null,
        idle: Math.round(g.camInfo.idle * 100) / 100,
        gnd: !!(g.capy && g.capy.grounded)
      })
    }, 60)
  })
  await page.waitForTimeout(9000)
  const out = await page.evaluate(() => {
    clearInterval(window.__iv)
    const s = window.__s
    let maxcv = 0, maxbv = 0, over = 0, drops = 0, prev = 0
    for (let i = 0; i < s.length; i++) {
      if (s[i].cv > maxcv) maxcv = s[i].cv
      if (s[i].bv > maxbv) maxbv = s[i].bv
      if (s[i].cv >= 1.8) over++
      if (s[i].idle < prev - 0.2) drops++
      prev = s[i].idle
    }
    const spikes = s.filter(function (r) { return r.cv >= 1.5 }).slice(0, 12)
    return { n: s.length, maxCapyV: maxcv, maxBodyV: maxbv, samplesOver18: over,
             idleDrops: drops, spikes: spikes,
             ungrounded: s.filter(function (r) { return !r.gnd }).length }
  })
  await page.evaluate(o => fetch('/shot?name=vz-pasto2.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
  await page.waitForTimeout(400)
}
