async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('cave')
    const b = g.capy.body, ter = g.cave.terrainHeight
    const H = g.cave.hand, base = ter(H.x, H.z)
    const RISE=0.78, N=32, TURN=0.46
    const handR = dy => 7.5 + (1.8-7.5)*Math.min(1,Math.max(0,dy/25))
    const down=c=>window.dispatchEvent(new KeyboardEvent('keydown',{code:c,bubbles:true}))
    const up=c=>window.dispatchEvent(new KeyboardEvent('keyup',{code:c,bubbles:true}))
    const res={base:+base.toFixed(2), fail:[], gapMax:0, chordMax:0}
    for(let k=0;k<N-1;k++){
      const dy=0.55+k*RISE, a=k*TURN, rr=handR(dy)*0.95
      const lx=H.x+Math.cos(a)*rr, lz=H.z+Math.sin(a)*rr
      const dy2=0.55+(k+1)*RISE, a2=(k+1)*TURN, rr2=handR(dy2)*0.95
      const tx=H.x+Math.cos(a2)*rr2, tz=H.z+Math.sin(a2)*rr2
      const chord=Math.hypot(tx-lx,tz-lz)
      if(chord>res.chordMax) res.chordMax=+chord.toFixed(2)
      b.position.set(lx,base+dy+0.55,lz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for(let i=0;i<50;i++) g.tick(1/60,false)
      const rest=g.capy.position.y
      down('Space'); for(let i=0;i<5;i++) g.tick(1/60,false); up('Space')
      let top=rest
      for(let i=0;i<70;i++){ g.tick(1/60,false); if(g.capy.position.y>top) top=g.capy.position.y }
      // the surface of ledge k+1 is base+dy2+0.21; the animal rests 0.55-ish above a surface
      const needApex = base+dy2+0.21
      const apexFoot = top - (rest - (base+dy+0.21))   // apex of the FEET
      const margin = apexFoot - needApex
      if(margin < 0.12) res.fail.push({k, margin:+margin.toFixed(2), chord:+chord.toFixed(2)})
      if(k===0||k===15||k===30) res.gapMax = Math.max(res.gapMax, +margin.toFixed(2))
    }
    // and the tip
    const tipY = base + 0.55 + (N-1)*RISE + 0.78
    b.position.set(H.x, tipY+1.0, H.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for(let i=0;i<90;i++) g.tick(1/60,false)
    res.onTip = { y:+g.capy.position.y.toFixed(2), need:+(base+24).toFixed(2), done:g.taskDone('hand-of-dog') }
    return res
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=jd.json',{method:'POST',body:btoa(JSON.stringify(o))}) }, out)
}
