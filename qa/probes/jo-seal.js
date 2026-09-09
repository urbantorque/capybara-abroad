async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE
    g.biome.switchTo('antarctic')
    for(let i=0;i<180;i++) g.tick(1/60,false)
    const S = g.antarctic.seal()
    const res = { sealAt:{x:+S.x.toFixed(1), z:+S.z.toFixed(1)}, trace:[] }
    // put the boat (and the animal on it) near her
    const b=g.capy.body
    // take the tiller: teleport the animal onto the helm then press E
    const helm = g.antarctic.boat.helm
    // simpler: put the swimming animal near the seal
    const px=S.x+16, pz=S.z+16
    b.position.set(px, g.antarctic.waterLevel+0.2, pz); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    let sawUp=false, minY=1e9, maxY=-1e9
    for(let i=0;i<60*45;i++){
      g.tick(1/60,false)
      // keep the animal roughly there, swimming
      const p=b.position
      if (Math.hypot(p.x-px,p.z-pz) > 6) { b.position.set(px, g.antarctic.waterLevel+0.2, pz); b.velocity.set(0,0,0) }
      const s=g.antarctic.seal()
      if(i%120===0) res.trace.push([+((i/60)).toFixed(0), +s.x.toFixed(1), +s.z.toFixed(1)])
      if(g.taskDone('leopard-seal') && !sawUp){ sawUp=true; res.tickedAt=+(i/60).toFixed(1) }
    }
    res.done = g.taskDone('leopard-seal')
    res.err = g.state.lastError||null
    // and a picture of her alongside
    g.renderer.setSize(1280,760,false); g.camera.aspect=1280/760; g.camera.fov=52; g.camera.updateProjectionMatrix()
    return res
  })
  await page.evaluate(async (o)=>{await fetch('/shot?name=jo.json',{method:'POST',body:btoa(JSON.stringify(o))})}, out)
}
