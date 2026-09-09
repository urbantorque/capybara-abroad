async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(20, 20)
  await page.waitForTimeout(300)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(3000)
  const names = ['pantanal','cave','antarctic']
  const out = {}
  for (const n of names) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, n)
    await page.waitForTimeout(1500)
    await page.evaluate(() => {
      const g = window.__capy, THREE = g.THREE
      const snap = []
      g.scene.traverse(o => {
        if (!o.isObject3D) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        if (o === g.capy.group) return
        snap.push([o, o.position.x, o.position.y, o.position.z])
      })
      window.__snap = snap
    })
    await page.waitForTimeout(2500)
    out[n] = await page.evaluate(() => {
      const g = window.__capy
      let moved = 0, total = 0, meshes = 0, tris = 0, inst = 0
      for (const [o, x, y, z] of window.__snap) {
        total++
        const d = Math.abs(o.position.x - x) + Math.abs(o.position.y - y) + Math.abs(o.position.z - z)
        if (d > 0.03) moved++
      }
      g.scene.traverse(o => {
        for (let p = o; p; p = p.parent) if (!p.visible) return
        if (o.isInstancedMesh) { inst += o.count; meshes++ }
        else if (o.isMesh) meshes++
        const gm = o.geometry
        if (gm && (o.isMesh || o.isInstancedMesh)) {
          const t = gm.index ? gm.index.count / 3 : (gm.attributes && gm.attributes.position ? gm.attributes.position.count / 3 : 0)
          tris += t * (o.isInstancedMesh ? o.count : 1)
        }
      })
      return { total, moved, meshes, inst, tris: Math.round(tris / 1000), npcs: g.npcs.length, props: g.props.length }
    })
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=Yauditlife.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
