async page => {
  // n1-shot: the pips row in its amber state and the tier card, photographed.
  await page.setViewportSize({ width: 1200, height: 700 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(4500)
  await page.keyboard.press('Digit1'); await page.waitForTimeout(3500)
  await page.evaluate(() => { const g = window.__capy; try { g.hud.cross('goreme') } catch (e) { g.biome.switchTo('goreme') } })
  await page.waitForTimeout(4500)
  await page.evaluate(() => {
    const g = window.__capy; const p = g.capy.position; const live = g.biome.current
    let k = 0, n = 0
    for (const r of g.locals) if (r.biome === live && r.group) n++
    for (const r of g.locals) {
      if (r.biome !== live || !r.group) continue
      const a = (k++ / Math.max(1, n)) * 6.283185
      r.x = p.x + Math.sin(a) * 13; r.z = p.z + Math.cos(a) * 13
      r.ax = r.x; r.az = r.z; r.tx = r.x; r.tz = r.z; r.wel = 0
      r.group.position.set(r.x, r.group.position.y, r.z)
      if (r.body) { r.body.position.x = r.x; r.body.position.z = r.z; r.body.aabbNeedsUpdate = true }
    }
    // fire-and-forget: five cones, 1.6 s apart
    let dropped = 0, nextDrop = 0; const t0 = performance.now()
    ;(function step() {
      const t = (performance.now() - t0) / 1000
      if (dropped < 5 && t >= nextDrop) {
        dropped++; nextDrop = t + 1.6
        const p = g.capy.position
        const pr = g.physics.spawnProp('cone', p.x + 1.4, p.z + 1.4)
        if (pr && pr.body) { pr.disturbed = true; pr.lastCapyTouch = g.state ? g.state.time : 0; pr.body.wakeUp(); pr.body.position.y += 2.4; pr.body.velocity.set(0, -6, 0) }
      }
      if (t < 9) requestAnimationFrame(step)
    })()
  })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'qa/n1-rung2.png' })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'qa/n1-march.png' })
  await page.waitForTimeout(4200)
  await page.screenshot({ path: 'qa/n1-tier.png' })
}
