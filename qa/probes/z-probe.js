async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const tops = []
    g.scene.children.forEach(o => tops.push([o.name || '(anon)', o.type, o.children.length, o.visible]))
    const npc0 = (g.npcs && g.npcs[0]) ? Object.keys(g.npcs[0]) : null
    const loc0 = (g.locals && g.locals[0]) ? Object.keys(g.locals[0]) : null
    const gk = Object.keys(g)
    return { tops, npcs: (g.npcs||[]).length, npc0, locals: (g.locals||[]).length, loc0, gk }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=zprobe.json',{method:'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}) }, out)
}
