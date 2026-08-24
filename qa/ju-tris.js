async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = {}
  for (const n of ['cave','antarctic']) {
    out[n] = await page.evaluate(async (name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      await new Promise(r=>setTimeout(r,900))
      let tris=0, meshes=0
      g.scene.traverse(o=>{
        if(!o.isMesh || !o.visible) return
        const geo=o.geometry; if(!geo) return
        const n = geo.index ? geo.index.count/3 : (geo.attributes.position ? geo.attributes.position.count/3 : 0)
        tris += n * (o.isInstancedMesh ? o.count : 1); meshes++
      })
      return { tris: Math.round(tris), meshes, bodies: g.world.bodies.length }
    }, n)
  }
  await page.evaluate(async (o)=>{await fetch('/shot?name=ju.json',{method:'POST',body:btoa(JSON.stringify(o))})}, out)
}
