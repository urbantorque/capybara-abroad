async page => {
  await page.reload(); await page.waitForTimeout(5500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = {}
  for (const n of ['cave','antarctic']) {
    out[n] = await page.evaluate(async (name) => {
      function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
      const g = window.__capy
      const errs = []
      const oe = console.error
      console.error = function(...a){ errs.push(a.map(x=>(x&&x.stack)||String(x)).join(' ')); oe.apply(console,a) }
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), cb = g.capy.body
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0,0,0)
      await sleep(400)
      const down = c => window.dispatchEvent(new KeyboardEvent('keydown',{code:c,bubbles:true}))
      const up = c => window.dispatchEvent(new KeyboardEvent('keyup',{code:c,bubbles:true}))
      // teleport around the world and wheek in each place, checking nothing throws
      const spots = name === 'cave'
        ? [[0,4,64],[4,-4,20],[16,-4,6],[4,-2,-48],[-12,-2,-34],[0,-6,-92],[-30,8,-126],[22,8,-132],[0,11,-166],[-20,-7,0]]
        : [[0,7,52],[-17,6,58],[24,14,92],[0,1,26],[-120,20,-110],[114,6,20],[0,-0.2,-200],[74,-0.2,-390],[16,-0.2,-260],[-86,3,-112]]
      for (const s of spots) {
        cb.position.set(s[0], s[1]+1.2, s[2]); cb.velocity.set(0,0,0)
        cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
        await sleep(500)
        down('Space'); await sleep(90); up('Space')
        await sleep(900)
      }
      // and take the tiller / drive for the boat chapter
      if (name === 'antarctic') {
        const b = g.antarctic.boat
        cb.position.set(b.helm.x, b.helm.y + 0.4, b.helm.z); cb.velocity.set(0,0,0)
        await sleep(500)
        down('KeyE'); await sleep(80); up('KeyE'); await sleep(400)
        down('KeyW'); await sleep(5000)
        down('Space'); await sleep(90); up('Space')
        await sleep(6000); up('KeyW')
        await sleep(1200)
      }
      const tasks = (g.state && g.state.tasksDone) || null
      return { errs: errs.slice(0,6), lastError: g.state.lastError || null,
               sailing: !!g.state.sailing, pos: [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(1), +g.capy.position.z.toFixed(1)] }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=biplay.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1)))) }) }, out)
}
