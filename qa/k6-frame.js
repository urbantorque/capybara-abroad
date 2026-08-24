async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE
    g.biome.switchTo('cave')
    const b=g.capy.body, ter=g.cave.terrainHeight, D=g.cave.doline
    const res=[]
    for (const yaw of [0, 1.6, 3.14, 4.7]) {
      b.position.set(D.x, ter(D.x,D.z)+0.5, D.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.input.camYaw = yaw
      for(let i=0;i<420;i++){ g.tick(1/60,false); b.position.set(D.x, ter(D.x,D.z)+0.5, D.z); b.velocity.set(0,0,0) }
      // is the animal visible? raycast from the eye to the animal against world meshes
      const cam=g.camera, p=g.capy.position
      const dir=new THREE.Vector3(p.x-cam.position.x, p.y+0.4-cam.position.y, p.z-cam.position.z)
      const dist=dir.length(); dir.normalize()
      const rc=new THREE.Raycaster(cam.position.clone(), dir, 0.2, dist-0.6)
      const hits=rc.intersectObjects(g.scene.children, true).filter(h=>h.object.isMesh && h.object.visible && !h.object.material.transparent)
      res.push({ yaw, boom:+dist.toFixed(2), eyeUp:+(cam.position.y-p.y).toFixed(2),
                 blocked: hits.length>0, by: hits[0]?(hits[0].object.name||'anon'):null,
                 atDist: hits[0]?+hits[0].distance.toFixed(1):null })
    }
    return res
  })
  await page.evaluate(async (o)=>{await fetch('/shot?name=k6.json',{method:'POST',body:btoa(JSON.stringify(o))})}, out)
}
