async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => window.__capy.biome.switchTo('kyoto'))
  await page.waitForTimeout(1500)
  const out = await page.evaluate(() => {
    const g = window.__capy, k = g.kyoto
    const r = { locals: [] }
    g.scene.traverse(o => {
      if (o.type === 'Group' && o.children.length && o.position && o.parent === g.scene) {
        // locals are added straight to the scene
      }
    })
    // read the locals list via npc api if exposed
    r.mill = { x: k.mill.x, z: k.mill.z }
    // sample the standing point the miller now uses
    return r
  })
  await page.evaluate((o) => fetch('/shot?name=s2kyo.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
