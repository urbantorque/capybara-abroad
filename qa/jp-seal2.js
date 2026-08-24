async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE
    g.biome.switchTo('antarctic')
    for(let i=0;i<180;i++) g.tick(1/60,false)
    const S0 = g.antarctic.seal().clone ? g.antarctic.seal().clone() : {...g.antarctic.seal()}
    const b=g.capy.body
    const px=S0.x+16, pz=S0.z+16
    b.position.set(px, g.antarctic.waterLevel+0.2, pz); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    const res={ start:{x:+S0.x.toFixed(1),z:+S0.z.toFixed(1)}, trace:[] }
    let shot1=false, shot2=false
    for(let i=0;i<60*50;i++){
      g.tick(1/60,false)
      const p=b.position
      if (Math.hypot(p.x-px,p.z-pz) > 6) { b.position.set(px, g.antarctic.waterLevel+0.2, pz); b.velocity.set(0,0,0) }
      const s=g.antarctic.seal()
      const d=Math.hypot(s.x-px, s.z-pz)
      if(i%150===0) res.trace.push([+((i/60)).toFixed(1), +d.toFixed(1)])
      if(!shot1 && i>60*6){ shot1=true
        g.renderer.setSize(1280,760,false); g.camera.aspect=1280/760; g.camera.fov=52; g.camera.updateProjectionMatrix()
        g.camera.position.set(px+9, g.antarctic.waterLevel+5.5, pz+11)
        g.camera.lookAt(new THREE.Vector3(px-1, g.antarctic.waterLevel, pz-3))
        g.camera.updateMatrixWorld(true); g.renderer.render(g.scene,g.camera)
        await fetch('/shot?name=R-seal.png',{method:'POST',body:g.renderer.domElement.toDataURL('image/png').split(',')[1]})
      }
    }
    res.minD = Math.min(...res.trace.map(t=>t[1]))
    res.done=g.taskDone('leopard-seal'); res.err=g.state.lastError||null
    return res
  })
  await page.evaluate(async (o)=>{await fetch('/shot?name=jp.json',{method:'POST',body:btoa(JSON.stringify(o))})}, out)
}
