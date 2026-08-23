async page => {
  await page.reload()
  await page.waitForTimeout(4500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const names = ['sydney','quay','pasto','kyoto','cali','rio','iceland','sahara','drift','venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic']
  const out = {}
  for (const n of names) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, n)
    await page.waitForTimeout(1200)
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      const inWorld = new Set(g.world.bodies.map(b => b.id))
      let total = 0, visible = 0, withBody = 0, attached = 0
      const arr = Array.isArray(g.npcs) ? g.npcs : (g.npcs && g.npcs.list ? g.npcs.list() : [])
      for (const r of arr) {
        total++
        const grp = r.group || r.mesh
        let vis = !!grp
        if (grp) { for (let p = grp; p; p = p.parent) if (!p.visible) { vis = false; break } }
        if (vis) visible++
        const b = r.body || r.cbody || r.physBody
        if (b) { withBody++; if (inWorld.has(b.id)) attached++ }
      }
      return { total, visible, withBody, attached, keys: arr.length ? Object.keys(arr[0]).slice(0,22) : [] }
    }, n)
  }
  await page.evaluate((o) => fetch('/shot?name=npc2.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
