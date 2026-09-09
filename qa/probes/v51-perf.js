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
      const info = g.renderer.info
      const ts = []
      let last = performance.now()
      for (let i = 0; i < 150; i++) {
        await new Promise(r => requestAnimationFrame(r))
        const t = performance.now(); ts.push(t - last); last = t
      }
      ts.sort((a, b) => a - b)
      const live = (g.props || []).filter(p => p && p.body && !p.removed &&
        (p.biome === name || (name === 'sydney' && (p.biome === undefined || p.biome === null))))
      let awake = 0
      for (const p of live) if (p.body.sleepState !== 2) awake++
      return { name, props: live.length, awake,
               bodies: g.world && g.world.bodies ? g.world.bodies.length : -1,
               tris: info.render.triangles, calls: info.render.calls,
               med: Math.round(ts[75] * 100) / 100, p90: Math.round(ts[135] * 100) / 100 }
    }, n))
  }
  await page.evaluate(o => fetch('/shot?name=v51perf.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
