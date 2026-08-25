async page => {
  await page.evaluate(() => {
    const g = window.__capy
    const root = g.scene.getObjectByName('pantanal')
    let off = 0
    root.traverse(n => {
      if (!n.isMesh || !n.geometry) return
      const gm = n.geometry
      const tri = (gm.index ? gm.index.count : gm.attributes.position.count) / 3
      const cnt = n.isInstancedMesh ? n.count : 1
      const t = tri * cnt
      // the four that were never meant to cast: grass, terrain plane, water sheet, baia litter
      if (gm.type === 'PlaneGeometry' && t > 5000) { n.castShadow = false; off += t; return }
      if (cnt > 3000) { n.castShadow = false; off += t; return }
      if (n.renderOrder === 1 && t > 5000) { n.castShadow = false; off += t; return }
    })
    window.__OFF = off
  })
  await page.waitForTimeout(2000)
}
