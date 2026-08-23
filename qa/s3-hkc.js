async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const cam = async (q) => {
    await page.evaluate(async (o) => {
      const g = window.__capy, THREE = g.THREE
      if (g.biome.current !== o.biome) g.biome.switchTo(o.biome)
      const b = g.capy.body
      b.position.set(o.px, o.py, o.pz); b.velocity.set(0,0,0)
      for (let i=0;i<(o.warm||60);i++) { g.tick(1/60,false); b.position.set(o.px,o.py,o.pz); b.velocity.set(0,0,0) }
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.fov = o.fov||50; g.camera.far = 4000
      g.camera.updateProjectionMatrix()
      g.camera.position.set(o.cx, o.cy, o.cz)
      g.camera.lookAt(new THREE.Vector3(o.tx, o.ty, o.tz))
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      await fetch('/shot?name=' + o.name, { method:'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
    }, q)
  }
  await cam({ biome:'kowloon', warm:200, px:20, py:1.4, pz:18, cx:14, cy:4.2, cz:18, tx:40, ty:1.6, tz:18, name:'HC-market.png' })
  await cam({ biome:'kowloon', px:29, py:1.4, pz:14, cx:22, cy:3.4, cz:26, tx:34, ty:1.4, tz:14, name:'HC-market2.png' })
  const err = await page.evaluate(() => { const g=window.__capy; return { e: g.state.lastError?String(g.state.lastError):'none',
    tris: (()=>{let t=0;g.scene.traverse(o=>{if(!(o.isMesh||o.isInstancedMesh))return;for(let p=o;p;p=p.parent)if(!p.visible)return;const gm=o.geometry;if(!gm)return;const n=gm.index?gm.index.count/3:(gm.attributes.position?gm.attributes.position.count/3:0);t+=n*(o.isInstancedMesh?o.count:1)});return Math.round(t)})() } })
  await page.evaluate(async (o) => { await fetch('/shot?name=hkc.json', { method:'POST', body: btoa(JSON.stringify(o)) }) }, err)
}
