async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy, o = {}
    const c = g.cali
    o.state = c.chivaState(); o.night = +c.night().toFixed(3)
    o.capy = { x: +g.capy.position.x.toFixed(1), y: +g.capy.position.y.toFixed(1), z: +g.capy.position.z.toFixed(1) }
    const sc = g.scene
    o.bg = sc.background && sc.background.isColor ? '#' + sc.background.getHexString() : null
    o.fog = sc.fog ? { c: '#' + sc.fog.color.getHexString(), near: +sc.fog.near.toFixed(0), far: +sc.fog.far.toFixed(0) } : null
    const lights = []
    sc.traverse(n => { if (n.isDirectionalLight || n.isHemisphereLight || n.isAmbientLight) lights.push([n.type, +n.intensity.toFixed(2), '#' + n.color.getHexString()]) })
    o.lights = lights
    // are the city lights actually on?
    let lit = 0, litVis = 0
    sc.traverse(n => {
      if (n.isInstancedMesh && n.material && n.material.emissiveIntensity > 0.01) { lit++; if (n.visible) litVis++ }
    })
    o.emissiveMeshes = lit; o.emissiveVisible = litVis
    o.post = g.post ? { enabled: g.post.enabled, bloom: g.post.bloom, threshold: g.post.threshold, vignette: g.post.vignette } : null
    // tasks
    const j = g.journey || {}
    o.taskApi = Object.keys(g).filter(k => /task|journey|noticed/i.test(k))
    o.doneMirador = (typeof g.taskDone === 'function') ? g.taskDone('chiva-mirador') : null
    o.noticedFns = typeof g.noticed
    return o
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=b3cali5.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
