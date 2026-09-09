async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
  const out = {}
  out.flags = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('manly')
    await new Promise(r=>setTimeout(r,600))
    const done = []
    g.events.on('task:complete', e => done.push(e && e.id))
    const held = new Set()
    const dn = c => { if (!held.has(c)) { held.add(c); window.dispatchEvent(new KeyboardEvent('keydown',{code:c,bubbles:true})) } }
    const up = c => { if (held.has(c)) { held.delete(c); window.dispatchEvent(new KeyboardEvent('keyup',{code:c,bubbles:true})) } }
    const allUp = () => { for (const c of Array.from(held)) up(c) }
    const press = () => { window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE',bubbles:true}))
      g.tick(1/60,false); g.tick(1/60,false)
      window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyE',bubbles:true})); g.tick(1/60,false) }
    const put = (x,y,z) => { const b=g.capy.body; b.position.set(x,y,z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); g.capy.position.set(x,y,z) }
    const walkTo = (tx,tz,n) => {
      for (let i=0;i<n;i++){
        const p = g.capy.position
        const dx = tx-p.x, dz = tz-p.z, l = Math.hypot(dx,dz)
        if (l < 1.1) break
        // world -> camera-relative: input.x = strafe, input.z = -forward
        const cy = Math.cos(g.input.camYaw), sy = Math.sin(g.input.camYaw)
        const ax = (dx/l)*cy - (dz/l)*sy
        const az = (dx/l)*sy + (dz/l)*cy
        if (ax > 0.30) { dn('KeyD'); up('KeyA') } else if (ax < -0.30) { dn('KeyA'); up('KeyD') } else { up('KeyA'); up('KeyD') }
        if (az > 0.30) { dn('KeyS'); up('KeyW') } else if (az < -0.30) { dn('KeyW'); up('KeyS') } else { up('KeyW'); up('KeyS') }
        g.tick(1/60,false)
      }
      allUp(); for (let i=0;i<20;i++) g.tick(1/60,false)
      return [ +g.capy.position.x.toFixed(1), +g.capy.position.z.toFixed(1) ]
    }
    const _f = g.manly.flags(); const fl = { x: _f.x, z: _f.z }   // SNAPSHOT: it is manV3b
    put(fl.x - 5.5, 2.0, fl.z + 3.5)
    for (let i=0;i<90;i++) g.tick(1/60,false)
    const at1 = walkTo(fl.x - 5.5, fl.z + 1.4, 800)
    press()
    const gotIt = g.manly.flags()
    const at2 = walkTo(fl.x - 30, fl.z + 1, 1400)
    press()
    const mid = [ +g.manly.flags().x.toFixed(1), +g.manly.flags().z.toFixed(1) ]
    for (let i=0;i<60*40;i++) g.tick(1/60,false)
    return { done: done.slice(), at1, at2, afterDrop: mid,
             flagNow: [ +g.manly.flags().x.toFixed(1), +g.manly.flags().z.toFixed(1) ],
             err: g.state.lastError||null }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=f9play.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
