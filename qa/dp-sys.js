async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    const R = {}
    g.biome.switchTo('kyoto')
    const s = g.biome.spawnOf('kyoto'), b = g.capy.body
    b.position.set(s.x, s.y, s.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    await sleep(1500)
    const ids = ["to-kyoto","torii-run","lantern-topple","zen-ruin","golden-swim","dry-crossing","bamboo-dash","uji-run","matcha-raid","whisk-spin","the-bell"]
    const paper = () => (document.querySelector('.capyui-todo')||{}).innerText || null
    const arrow = () => { const a = document.querySelector('.capyui-arrow'); return a ? getComputedStyle(a).opacity : null }
    R.arrowBefore = arrow()
    R.paperBefore = paper()
    for (const id of ids) { g.completeTask(id); await sleep(140) }
    await sleep(2600)
    R.paperAfter = paper()
    R.arrowAfter = arrow()
    R.doneCard = !!document.querySelector('.capyui-done')
    R.doneText = (document.querySelector('.capyui-done')||{}).innerText || null
    R.savePresent = !!localStorage.getItem('capy3.journey.v1')
    await sleep(4200)
    R.keepCard = !!document.querySelector('.capyui-keep')
    R.err = g.state.lastError ? String(g.state.lastError) : null
    return R
  })
  await page.evaluate(async o => { await fetch('/shot?name=dpsys.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}