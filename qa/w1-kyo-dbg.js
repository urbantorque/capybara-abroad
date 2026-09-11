async page => {
  const out = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const g = window.__capy; g.biome.switchTo('kyoto'); await sleep(1500)
    const k = g.kyoto; const c = k.chuteAt(1); const u = k.aheadOnRiver(c.x, c.z, -22)
    const b = g.capy.body; b.position.set(u.x, -0.5, u.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    const rows = []
    let fired = false, armed = false
    for (let i = 0; i < 600; i++) {
      await sleep(16)
      const f = k.chuteAt(1).fired
      if (!f) armed = true
      if (armed && f && !fired) fired = true
      if (fired) rows.push([+b.position.y.toFixed(3), +b.velocity.y.toFixed(2), g.capy.grounded ? 1 : 0])
      if (rows.length > 80) break
    }
    return { rows }
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=w1kyodbg.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
