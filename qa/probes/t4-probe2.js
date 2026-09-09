async page => {
  const out = {}
  for (const [n, pts] of [['kowloon',[[-6,0.6,48],[-6,0.6,44],[8,0.5,42]]],
                          ['venice',[[-6,-0.3,19],[-67,0.55,-11],[-67,0.6,-40],[-152,0.2,-80]]],
                          ['drift',[[7,84.6,-103],[-27,80.6,-108]]]]) {
    await page.evaluate((name) => {
      const g = window.__capy; g.biome.switchTo(name)
      for (let i=0;i<60;i++) g.tick(1/60,false)
    }, n)
    out[n] = await page.evaluate((o) => {
      const g = window.__capy, THREE = g.THREE
      const res = []
      for (const pt of o.pts) {
        const org = new THREE.Vector3(pt[0], pt[1], pt[2])
        const ray = new THREE.Raycaster(); ray.far = 3.4
        const meshes = []
        g.scene.traverse(m => { if (m.isMesh||m.isInstancedMesh) { let v=true; for(let p=m;p;p=p.parent) if(!p.visible) v=false; if(v) meshes.push(m) } })
        const hits = []
        for (let a=0;a<8;a++){
          const d = new THREE.Vector3(Math.cos(a*Math.PI/4),0,Math.sin(a*Math.PI/4))
          ray.set(org,d)
          const hs = ray.intersectObjects(meshes,false)
          if(!hs.length) continue
          const h = hs[0]
          if (h.distance>3.0 || (h.face && Math.abs(h.face.normal.y)>0.75)) continue
          // local triangle around the hit
          const gg = h.object.geometry, pos = gg.attributes.position
          const fi = h.faceIndex !== undefined ? h.faceIndex : 0
          const ia = gg.index
          const tri = []
          for (let v=0;v<3;v++) { const idx = ia ? ia.getX(fi*3+v) : fi*3+v
            tri.push([+pos.getX(idx).toFixed(1), +pos.getY(idx).toFixed(1), +pos.getZ(idx).toFixed(1)]) }
          hits.push({ d:+h.distance.toFixed(2), pt:[+h.point.x.toFixed(1),+h.point.y.toFixed(1),+h.point.z.toFixed(1)], tri })
        }
        res.push({ at: pt, hits: hits.slice(0,2) })
      }
      return res
    }, { pts: pts })
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=t4p2.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
