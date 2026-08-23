async page => {
  await page.reload(); await page.waitForTimeout(5000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2000)
  const runs = [
    { b:'kowloon', from:[ 7.2,0.6, 4],  to:[ 7.2,0.6,-32], name:'hk-east-lane-dpd' },
    { b:'kowloon', from:[ 9.3,0.6, 40], to:[ 9.3,0.6, 30], name:'hk-east-goods' },
    { b:'kowloon', from:[-9.3,0.6, 46], to:[-9.3,0.6, 34], name:'hk-west-goods' },
    { b:'kowloon', from:[ 7.0,0.6, 20], to:[ 7.0,0.6,-10], name:'hk-east-crossing' },
    { b:'kowloon', from:[-7.0,0.6, 34], to:[-7.0,0.6, 16], name:'hk-west-crossing' },
    { b:'venice', from:[-4,1.6,-24],  to:[-4,1.6,-44],  name:'ven-square-B2' },
    { b:'venice', from:[6.5,1.6,-46], to:[6.5,1.6,-32], name:'ven-torre-back' },
  ]
  const out = []
  for (const r of runs) {
    out.push(await page.evaluate(async (q) => {
      function sleep(ms){return new Promise(z=>setTimeout(z,ms))}
      const g = window.__capy
      if (g.biome.current !== q.b) { g.biome.switchTo(q.b); }
      const cb = g.capy.body
      cb.position.set(q.from[0], q.from[1], q.from[2]); cb.velocity.set(0,0,0)
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
      await sleep(250)
      const down=c=>window.dispatchEvent(new KeyboardEvent('keydown',{code:c,bubbles:true}))
      const up=c=>window.dispatchEvent(new KeyboardEvent('keyup',{code:c,bubbles:true}))
      const KEYS=['KeyW','KeyA','KeyS','KeyD']
      let held=null, stuck=0, worst=0, run=0
      let lx=cb.position.x, lz=cb.position.z
      const t0=performance.now()
      let closest=1e9
      while (performance.now()-t0 < 14000) {
        const p=g.capy.position
        const dx=q.to[0]-p.x, dz=q.to[2]-p.z
        const d=Math.hypot(dx,dz)
        if (d<closest) closest=d
        if (d<2.0) break
        // camera-relative: pick the key whose world direction best matches
        const yaw=g.input.camYaw||0
        const f={x:-Math.sin(yaw),z:-Math.cos(yaw)}
        const rgt={x:Math.cos(yaw),z:-Math.sin(yaw)}
        const fw=(dx*f.x+dz*f.z)/d, rt=(dx*rgt.x+dz*rgt.z)/d
        const want = Math.abs(fw)>Math.abs(rt) ? (fw>0?'KeyW':'KeyS') : (rt>0?'KeyD':'KeyA')
        if (held!==want){ if(held) up(held); down(want); held=want }
        await sleep(24)
        const moved=Math.hypot(p.x-lx,p.z-lz)
        if (moved<0.006) { run++; if(run>worst) worst=run; stuck++ } else run=0
        lx=p.x; lz=p.z
      }
      if (held) up(held)
      const p=g.capy.position
      return { name:q.name, reached: Math.hypot(q.to[0]-p.x, q.to[2]-p.z) < 2.6,
               closest:+closest.toFixed(1), stuckFrames:stuck, longestStall:worst,
               end:[+p.x.toFixed(1),+p.y.toFixed(1),+p.z.toFixed(1)] }
    }, r))
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wmwalk.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
