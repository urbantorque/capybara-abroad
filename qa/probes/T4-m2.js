async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2200)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('sahara')
    const sp = g.biome.spawnOf('sahara')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2200))
    const s = g.sahara
    // A REAL CHASE MOVES. Parked, every trader who has ever seen the animal
    // holds the same belief and a shout is never news — which is correct, and
    // is why the first cut of this test measured zero. Run it round the souk.
    const run = async (tellR) => {
      s.forceChase()
      let peakTold = 0, peakSeeing = 0, samples = 0
      const t0 = Date.now()
      while (Date.now() - t0 < 26000) {
        const u = (Date.now() - t0) / 1000
        // a lap of the souk at about 5 m/s, which is a run
        const a = u * 0.42
        const x = -20 + Math.cos(a) * 22, z = -34 + Math.sin(a) * 16
        g.capy.body.position.set(x, 0.4, z)
        g.capy.body.velocity.set(0, 0, 0)
        await new Promise(r => setTimeout(r, 160))
        const d = s.chaseDebug()
        if (d.told > peakTold) peakTold = d.told
        if (d.seeing > peakSeeing) peakSeeing = d.seeing
        samples++
        if (d.chase !== 1) s.forceChase()      // re-arm if they lose it
      }
      const fin = s.chaseDebug()
      return { peakTold, peakSeeing, samples,
               pairs: fin.tellPairs, inRange: fin.tellNear, losOk: fin.tellLos }
    }
    const on = await run()
    // ...and the control: the relay off. game.state.noTell cuts it.
    g.state.noTell = true
    const off = await run()
    g.state.noTell = false
    return { on, off, err: g.state.lastError || null }
  })
  await page.evaluate(o => fetch('/shot?name=T4-m2.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
