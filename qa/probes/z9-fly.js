async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('drift')
    const b = g.capy.body
    b.position.set(-30, 80.4, -108); b.velocity.set(0,0,0)
    for (let i=0;i<120;i++) { g.tick(1/60,false); b.position.set(-30,80.4,-108); b.velocity.set(0,0,0) }
    let fly = null
    g.scene.traverse(o => { if (o.isInstancedMesh && o.material && o.material.type === 'MeshBasicMaterial'
      && o.count === 46) fly = o })
    if (!fly) return { err: 'no lampfly mesh with count 46' }
    const m = new g.THREE.Matrix4(), v = new g.THREE.Vector3(), s = new g.THREE.Vector3()
    const q = new g.THREE.Quaternion()
    const rows = []
    for (let i = 0; i < Math.min(8, fly.count); i++) {
      fly.getMatrixAt(i, m); m.decompose(v, q, s)
      const c = fly.instanceColor ? [fly.instanceColor.getX(i), fly.instanceColor.getY(i), fly.instanceColor.getZ(i)] : null
      rows.push({ p: [+v.x.toFixed(1), +v.y.toFixed(1), +v.z.toFixed(1)], s: +s.x.toFixed(3),
                  c: c ? c.map(x => +x.toFixed(3)) : null })
    }
    return { visible: fly.visible, count: fly.count, mat: { vc: fly.material.vertexColors, op: fly.material.opacity,
             transparent: fly.material.transparent, tone: fly.material.toneMapped, col: fly.material.color.getHexString() },
             hasIC: !!fly.instanceColor, rows,
             geoHasColor: !!fly.geometry.attributes.color, err: g.state.lastError || null }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=z9fly.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
