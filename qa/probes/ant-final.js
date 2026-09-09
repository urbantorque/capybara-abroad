async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  const card = await page.evaluate(() => {
    const tiles = document.querySelectorAll('.capyui-pick, .capyui-place, [class*="pick"]')
    const names = []
    document.querySelectorAll('.capyui *').forEach(e => {})
    return { tiles: tiles.length,
             html: (document.querySelector('.capyui-title, .capyui-card, #ui') || document.body).innerText.slice(0, 900) }
  })
  await page.evaluate(async () => {
    const g = window.__capy
    g.renderer.setSize(1280, 760, false)
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  })
  await page.screenshot({ path: 'qa/ant-title.png' })
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  // travel via the departures board, the way a player would
  const board = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('antarctic')
    const sp = g.biome.spawnOf('antarctic')
    g.capy.body.position.set(sp.x, sp.y, sp.z); g.capy.body.velocity.set(0, 0, 0)
    return { biome: g.biome.current }
  })
  await page.waitForTimeout(3500)
  const arrived = await page.evaluate(() => {
    const g = window.__capy
    return { biome: g.biome.current, arrival: g.hud.isTaskDone('to-antarctic'),
             err: g.state.lastError || null, bodies: g.world.bodies.length,
             map: g.hud.mapMarkAudit ? g.hud.mapMarkAudit().missing : null }
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=antfinal.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, { card, board, arrived })
}
