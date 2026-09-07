async page => {
  // Why did A and B read `line: ''` five seconds after a crossing when the
  // wait alone is six? Wrap heardArm and sample the audit every 400 ms across
  // one crossing, so the arming and the saying are separate observations.
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)

  await page.evaluate(() => {
    const g = window.__capy
    window.__calls = []
    const raw = g.heardArm
    g.heardArm = function (place, kind) {
      const r = raw(place, kind)
      window.__calls.push({ place: place, kind: kind, got: r, at: Date.now() })
      return r
    }
    window.__trace = []
    window.__t0 = Date.now()
    window.__iv = setInterval(() => {
      const a = g.rumourAudit()
      window.__trace.push({ ms: Date.now() - window.__t0, line: a.line, t: a.t,
                            b: g.biome && g.biome.current })
    }, 400)
  })
  await page.evaluate(() => { window.__capy.hud.forceNoto(2, 0, 1) })
  const before = await page.evaluate(() => window.__capy.hud.notoAudit())
  await page.evaluate(() => { window.__capy.hud.cross('kyoto') })
  await page.waitForTimeout(16000)
  const out = await page.evaluate(() => {
    clearInterval(window.__iv)
    return { calls: window.__calls, trace: window.__trace }
  })
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=gossip-why.json', { method: 'POST', body: s })
  }, { before: before, calls: out.calls, trace: out.trace, errs: errs.slice(0, 4) })
}
