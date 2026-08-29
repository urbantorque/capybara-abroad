async page => {
  await page.reload()
  await page.waitForTimeout(4800)
  await page.keyboard.press('Digit0')
  await page.evaluate(() => {
    window.__s = []
    window.__t = 0
    window.__iv = setInterval(function () {
      const g = window.__capy
      if (!g.state.started) return
      window.__t += 0.05
      window.__s.push({ t: Math.round(window.__t * 100) / 100,
        p: Math.round(g.camInfo.pitch * 1800 / Math.PI) / 10,
        shot: Math.round(g.camInfo.shot * 100) / 100,
        rest: Math.round(g.camInfo.rest * 100) / 100 })
    }, 50)
  })
  await page.waitForTimeout(11000)
  const out = await page.evaluate(() => {
    clearInterval(window.__iv)
    const s = window.__s
    let maxJump = 0, atJump = null
    for (let i = 1; i < s.length; i++) {
      const d = Math.abs(s[i].p - s[i - 1].p)
      if (d > maxJump) { maxJump = Math.round(d * 100) / 100; atJump = s[i].t }
    }
    return { n: s.length, maxPitchStepPerFrame: maxJump, atT: atJump,
             trace: s.filter(function (r, i) { return i % 8 === 0 }).slice(0, 26) }
  })
  await page.evaluate(o => fetch('/shot?name=vz-arrive.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
  await page.waitForTimeout(300)
}
