async page => {
  await page.reload(); await page.waitForTimeout(5500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = {}
  for (const n of (globalThis.__names || ['drift'])) {}
  const names = ['quay']
  for (const n of names) {
    out[n] = await page.evaluate(async (name) => {
      function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      await sleep(1800)
      let tris=0, shadowTris=0, solo=0, inst=0, instances=0
      const geos=new Set()
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p=o;p;p=p.parent) if (!p.visible) return
        const gm=o.geometry; if(!gm) return
        geos.add(gm.uuid)
        const t = gm.index? gm.index.count/3 : (gm.attributes.position? gm.attributes.position.count/3:0)
        const cnt = o.isInstancedMesh? o.count:1
        tris += t*cnt; if(o.castShadow) shadowTris += t*cnt
        if(o.isInstancedMesh){inst++;instances+=cnt}else solo++
      })
      let locals=0
      for (const bd of g.world.bodies) if (bd.userData && bd.userData.local && bd.userData.local.biome===name) locals++
      const ts=[]; let last=performance.now(); const t0=last
      while (performance.now()-t0 < 4000) { await new Promise(r=>requestAnimationFrame(r)); const now=performance.now(); ts.push(now-last); last=now }
      ts.sort((a,c)=>a-c)
      return { tris:Math.round(tris), shadowTris:Math.round(shadowTris), meshes:solo+inst,
               instances, geos:geos.size, locals, bodies:g.world.bodies.length,
               med:+ts[(ts.length*0.5)|0].toFixed(2), p95:+ts[(ts.length*0.95)|0].toFixed(2),
               err: g.state.lastError||null }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=L2c.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
