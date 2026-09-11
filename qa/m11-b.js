async page => {
  const out = {}
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.evaluate(() => {
    const all = Array.prototype.slice.call(document.querySelectorAll('.capyui-go'))
    const b = all.filter(function (e) { return !e.classList.contains('alt') })[0] || all[0]
    if (b) b.click()
  })
  await page.waitForTimeout(2500)
  await page.evaluate(() => {
    const g = window.__capy
    window.__said = []
    const seen = new Set()
    // Every div in the page with an inline style and no class, which is what a
    // bubble is. Broad on purpose: the narrow filter found nothing and a probe
    // that finds nothing is indistinguishable from a feature that says nothing.
    window.__t = setInterval(function () {
      const els = document.querySelectorAll('div[style]')
      for (let i = 0; i < els.length; i++) {
        if (els[i].className) continue
        const t = (els[i].textContent || '').trim()
        if (t && t.length < 140 && !seen.has(t)) {
          seen.add(t); window.__said.push({ t: t, at: +g.state.time.toFixed(1) })
        }
      }
    }, 100)
    const b = g.capy.body
    window.__pin = setInterval(function () {
      b.position.set(30, 0.45, 26); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0)
    }, 16)
    g.events.emit('finale:staged', {})
  })
  // ...and then step out of the traveller's 9.5 m and back in, twice. Their
  // line is on a RISING EDGE of `near` (localsStep: `near && !r.was`), so a
  // probe that starts inside the radius can never see it — which reads exactly
  // like a pool that resolved empty.
  await page.waitForTimeout(9000)
  for (let k = 0; k < 3; k++) {
    await page.evaluate(() => {
      clearInterval(window.__pin)
      const b = window.__capy.capy.body
      window.__pin = setInterval(function () {
        b.position.set(30, 0.45, 48); b.velocity.set(0, 0, 0)
      }, 16)
    })
    await page.waitForTimeout(3000)
    await page.evaluate(() => {
      clearInterval(window.__pin)
      const b = window.__capy.capy.body
      window.__pin = setInterval(function () {
        b.position.set(30, 0.45, 22); b.velocity.set(0, 0, 0)
      }, 16)
    })
    await page.waitForTimeout(5000)
  }
  out.res = await page.evaluate(() => {
    clearInterval(window.__t); clearInterval(window.__pin)
    const g = window.__capy
    return { gathered: g.state.gathered, travMet: g.travMet ? g.travMet() : -1,
             said: window.__said.slice(0, 50) }
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=m11-b.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
