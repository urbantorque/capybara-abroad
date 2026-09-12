async page => {
  // L4 art review — which composite term lifts the blacks. Venice and Sydney:
  // base, then each depth term cut on game.state, then bloom zeroed, then the
  // shade's sky share (skyOcc) at 0.2 — all synchronous grabs off post.render().
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const CH = [['Digit0', 'venice'], ['Digit1', 'sydney']]
  const out = { rows: [] }
  for (const [key, name] of CH) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(11000)
    const row = await page.evaluate(async (name) => {
      const g = window.__capy
      const c = g.canvas || g.renderer.domElement
      const P = g.post.params
      const post = async (arm, url) => fetch('/shot?name=l4r-art-' + name + '-' + arm, { method: 'POST', body: url })
      const grab = () => { g.post.render(); return c.toDataURL('image/png') }
      const r = { name, params: JSON.parse(JSON.stringify(P)) }
      const urls = {}
      urls.p0 = grab()
      g.state.noDof = true; urls.nodof = grab(); g.state.noDof = false
      g.state.noAir = true; urls.noair = grab(); g.state.noAir = false
      g.state.noCrease = true; urls.nocrease = grab(); g.state.noCrease = false
      const kb = P.bloom, kw = P.wide; P.bloom = 0; P.wide = 0; urls.nobloom = grab(); P.bloom = kb; P.wide = kw
      const kc = P.contrast; P.contrast = 0.45; urls.contrast45 = grab(); P.contrast = kc
      const kl = [P.liftR, P.liftG, P.liftB]; P.liftR = -0.04; P.liftG = -0.04; P.liftB = -0.03; urls.liftneg = grab(); P.liftR = kl[0]; P.liftG = kl[1]; P.liftB = kl[2]
      for (const a in urls) await post(a, urls[a])
      return r
    }, name)
    out.rows.push(row)
  }
  await page.evaluate((o) => fetch('/shot?name=l4r-art-post.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
