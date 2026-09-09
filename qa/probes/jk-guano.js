async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE
    g.biome.switchTo('antarctic')
    for(let i=0;i<120;i++) g.tick(1/60,false)
    const C = g.antarctic.colony
    const res = { colony:C, meshes:[] }
    // find the big ground plane and read its vertex colour near the colony
    g.scene.traverse(o=>{
      if(!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.color) return
      const pos=o.geometry.attributes.position, col=o.geometry.attributes.color
      if (pos.count < 4000) return
      let best=-1, bd=1e9
      for(let i=0;i<pos.count;i++){
        const dx=pos.getX(i)-C.x, dz=pos.getZ(i)-C.z
        const d=dx*dx+dz*dz
        if(d<bd){bd=d;best=i}
      }
      if(best>=0 && bd<40) res.meshes.push({ n:pos.count, name:o.name||'(anon)',
        y:+pos.getY(best).toFixed(2),
        c:[+col.getX(best).toFixed(3),+col.getY(best).toFixed(3),+col.getZ(best).toFixed(3)],
        d:+Math.sqrt(bd).toFixed(2), renderOrder:o.renderOrder, mat:o.material.type })
    })
    // and a control sample far from the colony
    g.scene.traverse(o=>{
      if(!o.isMesh||!o.geometry||!o.geometry.attributes||!o.geometry.attributes.color) return
      const pos=o.geometry.attributes.position, col=o.geometry.attributes.color
      if (pos.count < 4000) return
      let best=-1,bd=1e9
      for(let i=0;i<pos.count;i++){ const dx=pos.getX(i)-(C.x+60), dz=pos.getZ(i)-(C.z-4); const d=dx*dx+dz*dz; if(d<bd){bd=d;best=i} }
      if(best>=0&&bd<40) res.control={ c:[+col.getX(best).toFixed(3),+col.getY(best).toFixed(3),+col.getZ(best).toFixed(3)] }
    })
    // rendered pixel test
    g.renderer.setSize(640,400,false); g.camera.aspect=640/400; g.camera.fov=52; g.camera.updateProjectionMatrix()
    g.camera.position.set(C.x, g.antarctic.terrainHeight(C.x,C.z)+40, C.z+30)
    g.camera.lookAt(new THREE.Vector3(C.x, g.antarctic.terrainHeight(C.x,C.z), C.z))
    g.camera.updateMatrixWorld(true); g.renderer.render(g.scene,g.camera)
    const cv=g.renderer.domElement
    const c2=document.createElement('canvas'); c2.width=640;c2.height=400
    const ctx=c2.getContext('2d'); ctx.drawImage(cv,0,0)
    const px=(X,Y)=>{const d=ctx.getImageData(X,Y,1,1).data; return [d[0],d[1],d[2]]}
    res.pixCentre = px(320,220)
    res.pixEdge = px(60,220)
    return res
  })
  await page.evaluate(async (o)=>{await fetch('/shot?name=jk.json',{method:'POST',body:btoa(JSON.stringify(o))})}, out)
}
