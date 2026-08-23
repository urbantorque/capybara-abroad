async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = {}
  const probes = {
    kowloon: [[-7.6,0.55,48],[7.6,0.55,43],[-7.6,0.55,-31],[8,0.55,28],[7.6,0.55,60]],
    venice:  [[-50,1.85,-35],[-6,-0.25,19],[-1,-0.25,19],[-67,0.55,-11],[-140,-0.8,-72]],
    drift:   [[7,84.6,-103],[-1,30.6,30],[10,30.6,30],[-2,39.2,-35],[91,33.1,21]],
  }
  for (const n of ['kowloon','venice','drift']) {
    await page.evaluate((name) => {
      const g = window.__capy; g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, n)
    await page.waitForTimeout(1200)
    out[n] = await page.evaluate((o) => {
      const g = window.__capy, THREE = g.THREE
      const meshes = []
      g.scene.traverse(m => { if ((m.isMesh||m.isInstancedMesh)) { let v=true; for(let p=m;p;p=p.parent) if(!p.visible) v=false; if(v) meshes.push(m) } })
      const ray = new THREE.Raycaster(); ray.far = 3.4
      const res = []
      for (const pt of o.pts) {
        const org = new THREE.Vector3(pt[0], pt[1], pt[2])
        const hits = []
        for (let a=0;a<8;a++){
          const d = new THREE.Vector3(Math.cos(a*Math.PI/4),0,Math.sin(a*Math.PI/4))
          ray.set(org,d)
          const hs = ray.intersectObjects(meshes,false)
          if(!hs.length) continue
          const h = hs[0]
          if (h.distance>3.0) continue
          if (h.face && Math.abs(h.face.normal.y)>0.75) continue
          let chain=[], ob=h.object
          for(let p=ob;p;p=p.parent) chain.push(p.name||p.type)
          ob.geometry.computeBoundingBox()
          const bb = ob.geometry.boundingBox
          hits.push({ d:+h.distance.toFixed(2), pt:[+h.point.x.toFixed(1),+h.point.y.toFixed(1),+h.point.z.toFixed(1)],
            chain: chain.slice(0,3).join('/'), inst: !!ob.isInstancedMesh, cnt: ob.count||0,
            bb:[Math.round(bb.min.x),Math.round(bb.min.y),Math.round(bb.min.z),Math.round(bb.max.x),Math.round(bb.max.y),Math.round(bb.max.z)],
            col: '#'+(Array.isArray(ob.material)?ob.material[0]:ob.material).color.getHexString() })
        }
        res.push({ at: pt, hits })
      }
      return res
    }, { pts: probes[n] })
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=t4name.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
