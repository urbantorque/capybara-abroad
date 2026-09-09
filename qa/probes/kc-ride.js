async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => { window.__capy.biome.switchTo('cali') })
  await page.waitForTimeout(1500)
  const out = await page.evaluate(() => {
    const g = window.__capy, c = g.cali
    const at0 = c.chivaAt()
    const b = g.capy.body
    // sit on the rack
    b.position.set(at0.x, at0.y + 4.2, at0.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    const track = []
    let state = '', stuckAt = null, lastP = null, still = 0
    for (let i = 0; i < 9000; i++) {
      // keep the animal glued on: the ride is what is being tested, not the hop
      const a = c.chivaAt()
      if (c.chivaState() !== 'arrived') {
        b.position.set(a.x, a.y + 4.05, a.z); b.velocity.set(a.v * Math.sin(a.yaw), 0, a.v * Math.cos(a.yaw))
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      }
      g.tick(1/60, false)
      const p = c.chivaAt()
      if (i % 60 === 0) track.push([Math.round(p.x), Math.round(p.y*10)/10, Math.round(p.z), Math.round(p.v*10)/10, c.chivaState()])
      if (lastP && c.chivaState() === 'rolling') {
        if (Math.hypot(p.x-lastP[0], p.z-lastP[1]) < 0.004) { still++; if (still > 240 && !stuckAt) stuckAt = [Math.round(p.x), Math.round(p.z), i] }
        else still = 0
      }
      lastP = [p.x, p.z]
      state = c.chivaState()
      if (state === 'arrived') break
    }
    return { state, stuckAt, frames: track.length, prog: c.rideProgress ? c.rideProgress() : null,
             track: track.filter((_,i)=>i%3===0), mirDone: c.night ? c.night() : null }
  })
  await page.evaluate((o) => fetch('/shot?name=kcride.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
