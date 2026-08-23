async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy
    const near = []
    g.scene.traverse(o => {
      if (!o.isMesh && !o.isInstancedMesh) return
      const p = o.getWorldPosition(new g.THREE.Vector3())
      const d = Math.hypot(p.x - (-54), p.z - (-24))
      if (d < 6 && Math.abs(p.y) < 12) {
        const m = Array.isArray(o.material)?o.material[0]:o.material
        near.push({ n: o.name || o.type, x:+p.x.toFixed(1), y:+p.y.toFixed(2), z:+p.z.toFixed(1),
                    c: m && m.color ? m.color.getHexString() : '-', vc: !!(m&&m.vertexColors) })
      }
    })
    const props = (g.props && g.props.list) ? g.props.list.map(p=>({t:p.type,x:+p.body.position.x.toFixed(1),y:+p.body.position.y.toFixed(2),z:+p.body.position.z.toFixed(1)})) : null
    return { near, props }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=w8.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
