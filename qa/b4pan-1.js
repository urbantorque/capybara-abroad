async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(7000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
    const g = window.__capy
    g.biome.switchTo('pantanal')
    await sleep(1500)
    const root = g.scene.getObjectByName('pantanal') ||
      (function(){ let f=null; g.scene.traverse(n=>{ if(!f && n.name && /pan/i.test(n.name)) f=n }); return f })()
    const rows = []
    let tot = 0, cast = 0
    const scan = (o, tag) => {
      o.traverse(n => {
        if (!n.isMesh || !n.geometry) return
        const gm = n.geometry
        const idx = gm.index ? gm.index.count : (gm.attributes.position ? gm.attributes.position.count : 0)
        let tri = idx / 3
        const cnt = (n.isInstancedMesh ? n.count : 1)
        const total = tri * cnt
        tot += total
        if (n.castShadow) cast += total
        rows.push({ tag, name: n.name || '', type: gm.type, inst: n.isInstancedMesh ? n.count : 0,
                    triGeo: tri, tri: total, cast: !!n.castShadow, recv: !!n.receiveShadow,
                    vis: n.visible, mat: n.material && n.material.type })
      })
    }
    // find every top-level child of the scene that is visible and belongs to pantanal
    const tops = []
    g.scene.children.forEach(c => { if (c.visible) tops.push(c) })
    tops.forEach(c => scan(c, c.name || c.type))
    rows.sort((a,b) => b.tri - a.tri)
    return { total: tot, castTotal: cast, top: rows.slice(0, 24),
             rootName: root ? root.name : null, nMesh: rows.length,
             biome: g.biome.current }
  })
  await page.evaluate(async o => { await fetch('/shot?name=b4pan-1.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
