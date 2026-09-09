async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE
    g.biome.switchTo('cave')
    const b = g.capy.body, ter = g.cave.terrainHeight
    const H = g.cave.hand, base = ter(H.x, H.z)
    const handR = dy => 7.5 + (1.8-7.5)*Math.min(1,Math.max(0,dy/25))
    const N=120, RISE=0.20, CH=0.95
    // rebuild the ramp path so the probe can follow it
    const path=[]; let ra=0
    for(let k=0;k<N;k++){ const dy=0.5+k*RISE, rr=handR(dy)+1.15
      path.push({x:H.x+Math.cos(ra)*rr, y:base+dy, z:H.z+Math.sin(ra)*rr}); ra+=CH/rr }
    const down=c=>window.dispatchEvent(new KeyboardEvent('keydown',{code:c,bubbles:true}))
    const up=c=>window.dispatchEvent(new KeyboardEvent('keyup',{code:c,bubbles:true}))
    const res={base:+base.toFixed(2), turns:+(ra/Math.PI/2).toFixed(2), pathLen:+(N*CH).toFixed(0)}
    // start at the foot of the ramp and WALK up it
    b.position.set(path[0].x, path[0].y+0.6, path[0].z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for(let i=0;i<60;i++) g.tick(1/60,false)
    let seg=2, stuckAt=null, stuck=0, maxY=g.capy.position.y, trace=[]
    for(let i=0;i<60*220 && seg<N;i++){
      const t=path[seg], p=g.capy.position
      const vx=t.x-p.x, vz=t.z-p.z, d=Math.hypot(vx,vz)
      const cy=g.input.camYaw
      // world forward for W: away from the camera
      const fx=-Math.sin(cy), fz=-Math.cos(cy)
      const rx=Math.cos(cy),  rz=-Math.sin(cy)
      const f=vx*fx+vz*fz, r=vx*rx+vz*rz
      up('KeyW');up('KeyS');up('KeyA');up('KeyD')
      if(f>0.15)down('KeyW'); else if(f<-0.15)down('KeyS')
      if(r>0.15)down('KeyD'); else if(r<-0.15)down('KeyA')
      g.tick(1/60,false)
      if(g.capy.position.y>maxY) maxY=g.capy.position.y
      if(i%60===0) trace.push([seg,+p.y.toFixed(2)]);
      if(d<1.0){ seg+=1; stuck=0 } else if(++stuck>60*6){ stuckAt={seg, d:+d.toFixed(2), y:+p.y.toFixed(2), want:+t.y.toFixed(2)}; break }
    }
    up('KeyW');up('KeyS');up('KeyA');up('KeyD')
    res.seg=seg; res.stuckAt=stuckAt; res.trace=trace.slice(0,40)
    res.maxY=+maxY.toFixed(2); res.taskAt=+(base+24).toFixed(2)
    res.done=g.taskDone('hand-of-dog')
    // picture
    g.renderer.setSize(1280,760,false); g.camera.aspect=1280/760; g.camera.fov=52; g.camera.updateProjectionMatrix()
    g.camera.position.set(H.x+26, base+14, H.z+26)
    g.camera.lookAt(new THREE.Vector3(H.x, base+11, H.z)); g.camera.updateMatrixWorld(true)
    g.renderer.render(g.scene,g.camera)
    await fetch('/shot?name=N-hand.png',{method:'POST',body:g.renderer.domElement.toDataURL('image/png').split(',')[1]})
    return res
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=je.json',{method:'POST',body:btoa(JSON.stringify(o))}) }, out)
}
