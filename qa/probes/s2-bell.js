async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => window.__capy.biome.switchTo('kyoto'))
  await page.waitForTimeout(1200)
  const out = await page.evaluate(() => {
    const g = window.__capy, k = g.kyoto, inp = g.input
    const log = []
    const heron = g.scene.getObjectByName('kyoHeron')
    const rope = k.bellRope()
    // stand at the rope, well away from the heron (which is at the pond, x 48/6)
    g.capy.body.position.set(rope.x, rope.y + 0.6, rope.z)
    g.capy.body.velocity.set(0,0,0)
    g.capy.body.previousPosition.copy(g.capy.body.position)
    for (let i=0;i<120;i++) g.tick(1/60,false)
    log.push('heron before y=' + heron.position.y.toFixed(2) + ' at (' + heron.position.x.toFixed(0) + ',' + heron.position.z.toFixed(0) + ')')
    inp.actionPressed = true; g.tick(1/60,false); inp.actionPressed = false
    log.push('ringing=' + k.bellRinging())
    for (let i=0;i<300;i++) g.tick(1/60,false)   // 5 s: past the 4.5 s wind-up
    log.push('after strike: ringing=' + k.bellRinging() + ' heron y=' + heron.position.y.toFixed(2))
    for (let i=0;i<120;i++) g.tick(1/60,false)
    log.push('+2s: heron y=' + heron.position.y.toFixed(2) + ' at (' + heron.position.x.toFixed(0) + ',' + heron.position.z.toFixed(0) + ')')
    return { log, err: g.state.lastError || null }
  })
  await page.evaluate((o) => fetch('/shot?name=s2bell.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
