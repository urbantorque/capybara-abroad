async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() }); await page.waitForTimeout(5000)
  await page.evaluate(() => window.__capy.hud.cross('kyoto')); await page.waitForTimeout(9000)
  const out = await page.evaluate(() => {
    const g = window.__capy, k = g.kyoto
    const rows = []
    let x = 150, z = 138
    for (let i = 0; i < 16; i++) {
      const a = k.aheadOnRiver(x, z, 4); x = a.x; z = a.z
      rows.push({ x: +x.toFixed(1), z: +z.toFixed(1), water: +k.waterHeightAt(x, z).toFixed(2), ground: k.terrainHeight ? +k.terrainHeight(x, z).toFixed(2) : null })
    }
    return { rows, len: k.riverLength(), mill: k.runAudit().mill, api: Object.keys(k).filter(n => /river|water|terrain|pond|mill|chute/i.test(n)) }
  })
  await page.evaluate(o => fetch('/shot?name=l7-uji-dbg.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
