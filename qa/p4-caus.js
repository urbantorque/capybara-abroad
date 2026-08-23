async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('palawan')
    const b = g.capy.body
    b.position.set(-13, -3, 4); b.velocity.set(0,0,0)
    for (let i=0;i<60;i++) g.tick(1/60,false)
    const rows = []
    g.scene.traverse(o => {
      if (!o.isMesh) return
      const gm = o.geometry
      const ca = gm && gm.attributes && gm.attributes.color
      if (!ca || ca.itemSize !== 4) return
      let minA = 9, maxA = -9, y0 = 9e9, y1 = -9e9
      const a = ca.array
      for (let i = 3; i < a.length; i += 4) { if (a[i] < minA) minA = a[i]; if (a[i] > maxA) maxA = a[i] }
      const pa = gm.attributes.position.array
      for (let i = 1; i < pa.length; i += 3) { if (pa[i] < y0) y0 = pa[i]; if (pa[i] > y1) y1 = pa[i] }
      const m = o.material
      rows.push({ vis: o.visible, ro: o.renderOrder, minA:+minA.toFixed(3), maxA:+maxA.toFixed(3),
        y0:+y0.toFixed(2), y1:+y1.toFixed(2), verts: ca.count,
        vc: m.vertexColors, op: m.opacity, blend: m.blending,
        col: '#' + m.color.getHexString(),
        prog: !!(m.userData && m.userData.shader) })
    })
    // is the shader actually compiled with sparkle? check program count
    return { rows, grainT: (window.__capy.state.time).toFixed(1) }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=p4caus.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
