async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const done = []
    g.events.on('task:complete', e => done.push(e && e.id))
    g.biome.switchTo('pantanal')
    await new Promise(r=>setTimeout(r,800))
    const put = (x,y,z) => { const b=g.capy.body; b.position.set(x,y,z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); g.capy.position.set(x,y,z) }
    const res = {}
    // ---- caiman-nap: drop onto the driest one
    const c = g.pantanal.caiman(); const cs = { x: c.x, y: c.y, z: c.z }
    put(cs.x, cs.y + 1.1, cs.z)
    for (let i=0;i<60*4;i++) g.tick(1/60,false)
    res.caiman = { at: cs, y: +g.capy.position.y.toFixed(2), done: done.indexOf('caiman-nap')>=0 }
    // ---- gather: wheek at grazers repeatedly
    const dn = c2 => window.dispatchEvent(new KeyboardEvent('keydown',{code:c2,bubbles:true}))
    const up = c2 => window.dispatchEvent(new KeyboardEvent('keyup',{code:c2,bubbles:true}))
    for (let k=0;k<9;k++) {
      const h = g.pantanal.herd(); const hs = { x: h.x, z: h.z }
      put(hs.x + 1.5, 2.0, hs.z + 1.5)
      for (let i=0;i<40;i++) g.tick(1/60,false)
      dn('KeyQ'); g.tick(1/60,false); g.tick(1/60,false); up('KeyQ')
      for (let i=0;i<40;i++) g.tick(1/60,false)
    }
    res.following = g.pantanal.following()
    // ---- the crossing: swim south down the crossing with the line behind
    put(-34, 2.0, -50)
    for (let i=0;i<90;i++) g.tick(1/60,false)
    const steps = []
    for (let leg = 0; leg < 3; leg++) {
      const tz = [-58, -70, -84][leg]
      for (let i=0;i<60*30;i++) {
        const p = g.capy.position
        if (p.z < tz) break
        const cy = Math.cos(g.input.camYaw), sy = Math.sin(g.input.camYaw)
        const ax = 0*cy - (-1)*sy, az = 0*sy + (-1)*cy
        if (ax > 0.30) { dn('KeyD'); up('KeyA') } else if (ax < -0.30) { dn('KeyA'); up('KeyD') } else { up('KeyA'); up('KeyD') }
        if (az > 0.30) { dn('KeyS'); up('KeyW') } else if (az < -0.30) { dn('KeyW'); up('KeyS') } else { up('KeyW'); up('KeyS') }
        g.tick(1/60,false)
      }
      steps.push([+g.capy.position.x.toFixed(1), +g.capy.position.z.toFixed(1), g.pantanal.following()])
    }
    for (const k of ['KeyW','KeyA','KeyS','KeyD']) up(k)
    for (let i=0;i<180;i++) g.tick(1/60,false)
    res.cross = { steps, dusk: +g.pantanal.dusk().toFixed(2), done: done.indexOf('the-crossing')>=0 }
    res.all = done.slice()
    res.err = g.state.lastError || null
    return res
  })
  await page.evaluate(async (o)=>{ await fetch('/shot?name=fgtasks.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
