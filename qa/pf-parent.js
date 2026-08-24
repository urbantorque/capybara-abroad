// Every prop in physUpdate's loop passes `p.mesh.parent !== physGame.scene ->
// continue`, which was written for "an NPC picked it up and is driving it". If a
// prop's mesh is parented anywhere else for any other reason, the prop gets NO
// buoyancy, NO aerodynamics, NO gust, NO spill and NO tip — and its picture
// stops being synced to its body. Count them, per chapter.
async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const names = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                 'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic']
  const out = {}
  for (const n of names) {
    out[n] = await page.evaluate(async (name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
      const live = g.biome.current
      const mine = g.props.filter(p => !p.removed && !p.hidden && !p.held &&
        (!p.biome || p.biome === live))
      const orphan = mine.filter(p => p.mesh && p.mesh.parent !== g.scene && !p.owner)
      const byParent = {}
      for (const p of orphan) {
        const pn = (p.mesh.parent && (p.mesh.parent.name || p.mesh.parent.type)) || 'null'
        byParent[pn] = (byParent[pn] || 0) + 1
      }
      return { props: mine.length, skipped: orphan.length, byParent,
               sample: orphan.slice(0, 5).map(p => p.type) }
    }, n)
  }
  await page.evaluate(async o => {
    await fetch('/shot?name=pfparent.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
