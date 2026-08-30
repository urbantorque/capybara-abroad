async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const NAMES = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift','venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic','monaco','hanoi']
  const out = []
  for (const n of NAMES) {
    out.push(await page.evaluate(async name => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), cb = g.capy.body
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0)
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
      await sleep(2500)
      const cur = g.biome.current
      const live = (g.props || []).filter(p => p && p.body && !p.removed &&
        (p.biome === cur || (cur === 'sydney' && (p.biome === undefined || p.biome === null))))
      const grab = live.filter(p => p.grabbable)
      const ring = (arr, r) => arr.filter(p =>
        Math.hypot(p.body.position.x - sp.x, p.body.position.z - sp.z) < r).length
      const types = {}
      for (const p of live) types[p.type] = (types[p.type] || 0) + 1
      return { name, live: live.length, grab: grab.length,
               p20: ring(live, 20), p40: ring(live, 40), p80: ring(live, 80),
               g20: ring(grab, 20), g40: ring(grab, 40), types }
    }, n))
  }
  await page.evaluate(o => fetch('/shot?name=v51spawn.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
