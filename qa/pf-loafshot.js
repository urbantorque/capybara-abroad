// Judge the loaf from the RENDERED PNG, never from the numbers.
//
// Framed in MANLY and not in Sydney: Sydney's gardeners pick the animal up, and
// the first cut of this shot caught it dangling from one — which is `carried`,
// a different pose entirely, and nothing to do with what is being judged.
async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const shot = async (name) => {
    await page.evaluate(async (n) => {
      const g = window.__capy
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280 / 760; g.camera.updateProjectionMatrix()
      for (let i = 0; i < 3; i++) g.tick(1 / 60, true)
      await fetch('/shot?name=' + n, { method: 'POST', body: g.canvas.toDataURL('image/png') })
    }, name)
  }
  const run = (n) => page.evaluate((k) => {
    const g = window.__capy
    for (let i = 0; i < k; i++) g.tick(1 / 60, false)
  }, n)

  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('manly')
    const sp = g.biome.spawnOf('manly'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.input.camYaw = 2.2
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
  })
  // pull the lens in so the pose is readable at all
  for (let i = 0; i < 14; i++) await page.mouse.wheel(0, -120)
  await run(60)
  // walking, so the loaf is definitely down
  await page.evaluate(() => {
    const g = window.__capy
    for (let i = 0; i < 45; i++) { g.input.x = 0.6; g.tick(1 / 60, false) }
    g.input.x = 0
    for (let i = 0; i < 10; i++) g.tick(1 / 60, false)
  })
  await shot('pf-loaf-standing')
  await run(60 * 16)
  await shot('pf-loaf-sat')
  const st = await page.evaluate(() => {
    const g = window.__capy
    const a = g.hud.calmAudit()
    return { loaf: +g.capy.loaf.toFixed(2), calm: +a.calm.toFixed(2),
             carried: !!g.capy.carriedBy, swim: !!g.capy.swimming,
             crit: a.critters.filter(c => c.live).map(c => ({ near: +c.near.toFixed(2), appr: +c.appr.toFixed(2) })),
             err: g.state.lastError ? String(g.state.lastError) : null }
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=pfloafshot.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, st)
}
