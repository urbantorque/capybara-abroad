async page => {
  await page.reload()
  await page.waitForTimeout(4500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy, THREE = g.THREE
    const bb = new THREE.Box3()
    const res = { npcs: [], capy: null }
    const list = g.npcs && g.npcs.list ? g.npcs.list() : (Array.isArray(g.npcs) ? g.npcs : null)
    let n = 0
    g.scene.traverse(o => {
      if (n >= 6) return
      if (!o.isGroup) return
      const nm = (o.name || '')
      if (!/npc|person|people|tourist|walker/i.test(nm)) return
      bb.setFromObject(o)
      res.npcs.push({ nm, h: +(bb.max.y - bb.min.y).toFixed(2), w: +(bb.max.x - bb.min.x).toFixed(2) })
      n++
    })
    if (g.capy && g.capy.group) { bb.setFromObject(g.capy.group); res.capy = { h: +(bb.max.y-bb.min.y).toFixed(2), l: +(bb.max.z-bb.min.z).toFixed(2), w: +(bb.max.x-bb.min.x).toFixed(2) } }
    res.capyMass = g.capy && g.capy.body ? g.capy.body.mass : null
    res.gravity = [g.world.gravity.x, g.world.gravity.y, g.world.gravity.z]
    return res
  })
  await page.evaluate((o) => fetch('/shot?name=scale.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
