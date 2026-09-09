async page => {
  const out = await page.evaluate(async () => {
    const g = window.__capy, b = g.capy.body
    g.biome.switchTo('venice')
    b.position.set(-4, 1.6, -30); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    const rows = []
    for (let k=0;k<8;k++) {
      for (let i=0;i<60*18;i++){ g.tick(1/60,false); b.position.set(-4,1.6,-30); b.velocity.set(0,0,0) }
      let mm = null
      g.scene.traverse(o => { if (o.isInstancedMesh && o.renderOrder === 4 && o.material.blending === 2) mm = o })
      rows.push({ tide: +g.venice.tide().toFixed(2), y: +g.venice.tideY().toFixed(2),
                  mirror: mm ? { n: mm.count, vis: mm.visible, op: +mm.material.opacity.toFixed(3) } : null })
    }
    return rows
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=t4mir.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
