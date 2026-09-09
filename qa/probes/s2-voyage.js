async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => window.__capy.biome.switchTo('quay'))
  await page.waitForTimeout(1200)
  const out = await page.evaluate(() => {
    const g = window.__capy, q = g.quay, inp = g.input
    const log = []
    const toasts = []
    const ot = g.toast
    g.toast = function (t) { toasts.push(t); return ot && ot.call(g, t) }
    const h = q.boat.helm
    g.capy.body.position.set(h.x, h.y + 0.2, h.z - 1)
    g.capy.body.velocity.set(0,0,0)
    for (let i=0;i<12;i++) g.tick(1/60,false)
    inp.actionPressed = true; g.tick(1/60,false); inp.actionPressed = false
    log.push('atHelm=' + q.boat.atHelm)
    // steer for the buoys in order, then Manly
    const WP = [[19,-40],[39,-150],[69,-300],[99,-440],[100,-516],[130,-544]]
    let wp = 0, frames = 0, bumps = 0
    let lastX = q.boat.position.x, lastZ = q.boat.position.z
    while (wp < WP.length && frames < 9000) {
      const bx = q.boat.position.x, bz = q.boat.position.z
      const want = Math.atan2(WP[wp][0]-bx, WP[wp][1]-bz)
      let d = want - q.boat.heading
      while (d>Math.PI) d-=Math.PI*2
      while (d<-Math.PI) d+=Math.PI*2
      const dToGo = Math.hypot(bx-WP[wp][0], bz-WP[wp][1]); inp.z = (wp === WP.length-1 && dToGo < 55) ? (q.boat.speed > 3 ? 0.5 : 0) : -1
      inp.x = Math.max(-1, Math.min(1, -d*2.2))
      g.tick(1/60,false)
      frames++
      if (Math.hypot(bx-WP[wp][0], bz-WP[wp][1]) < 22) { wp++; log.push('wp'+wp+' @'+(frames/60).toFixed(1)+'s') }
      lastX = bx; lastZ = bz
    }
    inp.z = 0; inp.x = 0
    for (let f=0;f<600;f++) g.tick(1/60,false)
    log.push('arrived=' + q.arrived() + ' at ('+q.boat.position.x.toFixed(1)+','+q.boat.position.z.toFixed(1)+') after '+(frames/60).toFixed(1)+'s')
    g.toast = ot
    return { log, toasts, tasks: (g.state.done ? Object.keys(g.state.done).length : -1),
             err: g.state.lastError || null }
  })
  await page.evaluate((o) => fetch('/shot?name=s2voyage.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
