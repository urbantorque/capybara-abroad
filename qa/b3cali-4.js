async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy, o = {}
    if (!g.biome.isActive('cali')) {
      g.biome.switchTo('cali')
      const sp = g.biome.spawnOf('cali'), b0 = g.capy.body
      b0.position.set(sp.x, sp.y, sp.z); b0.velocity.set(0, 0, 0)
      b0.previousPosition.copy(b0.position); b0.interpolatedPosition.copy(b0.position)
      for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    }
    const c = g.cali, b = g.capy.body
    const stick = () => {
      const a = c.chivaAt()
      b.position.set(a.x, a.y + 3.70 + 0.34, a.z)
      b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }
    stick()
    let n = 0
    for (let i = 0; i < 60 * 220; i++) {
      if (!c.onChiva()) stick()
      g.tick(1 / 60, true)
      n++
      if (c.chivaState() === 'arrived') break
    }
    for (let i = 0; i < 30; i++) g.tick(1 / 60, true)
    o.frames = n
    o.state = c.chivaState(); o.night = +c.night().toFixed(3); o.skyward = +c.skyward().toFixed(3)
    o.capy = { x: +g.capy.position.x.toFixed(1), y: +g.capy.position.y.toFixed(1), z: +g.capy.position.z.toFixed(1) }
    return o
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=b3cali4.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
