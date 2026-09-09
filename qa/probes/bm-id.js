async page => {
  await page.reload(); await page.waitForTimeout(5200)
  await page.mouse.click(400, 400); await page.waitForTimeout(2000)
  const out = await page.evaluate(async () => {
    function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
    const g = window.__capy, THREE = g.THREE
    g.biome.switchTo('antarctic')
    const cb = g.capy.body
    cb.position.set(0, 7, 52); cb.velocity.set(0,0,0)
    await sleep(1200)
    // raycast from the shot camera through the middle of the black slab
    g.camera.position.set(6, 11, 66)
    g.camera.lookAt(new THREE.Vector3(-4, 1, 34))
    g.camera.updateMatrixWorld(true)
    const rc = new THREE.Raycaster()
    const hits = []
    for (const uv of [[0.19, 0.10], [0.18, -0.20], [0.20, 0.30]]) {
      rc.setFromCamera(new THREE.Vector2(uv[0], uv[1]), g.camera)
      const all = rc.intersectObjects(g.scene.children, true); const hs = all.filter(h => { let o=h.object; for(let p=o;p;p=p.parent) if(!p.visible) return false; return true }).slice(0, 4)
      hits.push(hs.map(h => {
        let nm = h.object.name || h.object.type
        let q = h.object.parent, guard = 0
        while (q && guard++ < 4) { if (q.name) nm = q.name + '/' + nm; q = q.parent }
        const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material
        return { nm, d: +h.distance.toFixed(1), col: m && m.color ? '#' + m.color.getHexString() : '',
                 inst: !!h.object.isInstancedMesh, iid: h.instanceId === undefined ? -1 : h.instanceId,
                 pt: [+h.point.x.toFixed(1), +h.point.y.toFixed(1), +h.point.z.toFixed(1)],
                 tris: h.object.geometry && h.object.geometry.index ? h.object.geometry.index.count/3 : 0 }
      }))
    }
    return hits
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=bmid.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
