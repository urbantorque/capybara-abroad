async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch(e){} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
    const g = window.__capy
    g.biome.switchTo('manly'); await sleep(400)
    const sp = g.biome.spawnOf('manly'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
    for (let i = 0; i < 90; i++) g.tick(1/60, false)
    const m = g.manly, o = {}
    const root = g.scene.getObjectByName('manly')
    // GROUND IS NOT SCENERY. Skip the terrain / water / foam sheets: they cover
    // the whole map and would make every cell look full.
    const SKIP = /water|sea|sand|ground|terrain|foam|haze|spray|sky/i
    const CELL = 20
    const cells = {}
    let objs = 0, verts = 0
    function xf(e, x, y, z) { return [ e[0]*x+e[4]*y+e[8]*z+e[12], e[2]*x+e[6]*y+e[10]*z+e[14] ] }
    root.traverse(n => {
      if (!(n.isMesh || n.isInstancedMesh)) return
      const nm = (n.name || '') + ' ' + ((n.material && n.material.name) || '')
      if (SKIP.test(nm)) return
      const pos = n.geometry && n.geometry.attributes && n.geometry.attributes.position
      if (!pos) return
      objs++
      n.updateWorldMatrix(true, false)
      const stride = Math.max(1, Math.floor(pos.count / 400))
      const E = n.matrixWorld.elements
      if (n.isInstancedMesh) {
        const ia = n.instanceMatrix.array
        for (let i = 0; i < n.count; i++) {
          const p2 = xf(E, ia[i*16+12], ia[i*16+13], ia[i*16+14])
          const k = Math.floor(p2[0]/CELL)+','+Math.floor(p2[1]/CELL)
          cells[k] = (cells[k]||0) + 1; verts++
        }
      } else {
        for (let i = 0; i < pos.count; i += stride) {
          const p2 = xf(E, pos.getX(i), pos.getY(i), pos.getZ(i))
          const k = Math.floor(p2[0]/CELL)+','+Math.floor(p2[1]/CELL)
          cells[k] = (cells[k]||0) + 1; verts++
        }
      }
    })
    o.objs = objs; o.verts = verts
    o.skipped = []
    root.traverse(n => { if ((n.isMesh||n.isInstancedMesh) && SKIP.test((n.name||'')+' '+((n.material&&n.material.name)||''))) o.skipped.push(n.name || '(unnamed)') })
    // the route the player actually walks: ferry-side spawn -> Corso -> beach ->
    // waterline -> along to the ocean pool and Shelly
    const route = []
    for (let z = 62; z >= 26; z -= 4) route.push([0, z])        // Corso to beach
    for (let x = -40; x <= 90; x += 5) route.push([x, 28])       // along the sand
    for (let z = 24; z >= -30; z -= 4) route.push([0, z])        // out the back
    const seen = {}, list = []
    for (const r of route) {
      const k = Math.floor(r[0]/CELL)+','+Math.floor(r[1]/CELL)
      if (seen[k]) continue; seen[k] = 1
      list.push({ k: k, at: [r[0], r[1]], n: cells[k]||0 })
    }
    o.route = list
    o.dead = list.filter(c => c.n === 0)
    o.thin = list.filter(c => c.n > 0 && c.n < 40)
    return o
  })
  await page.evaluate(async o => { await fetch('/shot?name=b4man-6.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
