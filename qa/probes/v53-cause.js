async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(4000)
  const out = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const g = window.__capy
    const CANNON = g.CANNON
    const dyn = () => (g.props || []).filter(p => p && p.body && !p.removed && !p.held &&
      p.body.type === CANNON.Body.DYNAMIC && p.mass > 0.2)
    const results = []
    const trial = async (name, ageOfTouch, expect) => {
      const ps = dyn()
      if (ps.length < 2) return results.push({ name, error: 'not enough props' })
      const A = ps[0], B = ps[1]
      const t = g.state.time
      // Put B two metres in front of A on open lawn, both awake and settled.
      const x = 4, z = 30
      A.body.wakeUp(); B.body.wakeUp()
      A.body.position.set(x, 1.1, z); A.body.velocity.set(0, 0, 0)
      A.body.angularVelocity.set(0, 0, 0)
      B.body.position.set(x + 2.0, 1.1, z); B.body.velocity.set(0, 0, 0)
      B.body.angularVelocity.set(0, 0, 0)
      // B is untouched by anything.
      B.disturbed = false; B.lastCapyTouch = -999; B.releaseTime = -999;
      // A is a prop the capybara shoved `ageOfTouch` seconds ago — which is
      // exactly the state physStampTouch leaves behind.
      A.disturbed = true; A.lastCapyTouch = t - ageOfTouch; A.releaseTime = -999;
      await sleep(120)
      A.body.wakeUp()
      A.body.velocity.set(7, 0, 0)          // straight at B
      await sleep(1400)
      results.push({
        name, ageOfTouch, expect,
        bDisturbed: !!B.disturbed,
        bInheritedTouch: B.lastCapyTouch > -900 ? Math.round((g.state.time - B.lastCapyTouch) * 10) / 10 : null,
        aTypes: A.type + ' -> ' + B.type,
        pass: !!B.disturbed === expect,
      })
    }
    // fresh shove: causation must travel one hop
    await trial('fresh shove (0.2 s old)', 0.2, true)
    // stale: the striker's own clock has run out, nothing propagates
    await trial('stale shove (5 s old)', 5.0, false)
    return results
  })
  await page.evaluate(o => fetch('/shot?name=v53cause.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
