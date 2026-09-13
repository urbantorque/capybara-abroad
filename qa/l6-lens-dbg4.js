async page => {
  await page.evaluate(() => { const g = window.__capy; g.renderer.shadowMap.type = 1; g.scene.traverse(o => { if (o.isMesh && o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { m.needsUpdate = true }) } }) })
  await page.waitForTimeout(8000)
  await page.screenshot({ path: 'qa/l6-lens-dbg-pcf.png' })
  await page.evaluate(() => { const g = window.__capy; g.renderer.shadowMap.type = 2; g.scene.traverse(o => { if (o.isMesh && o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { m.needsUpdate = true }) } }) })
  await page.waitForTimeout(8000)
  await page.screenshot({ path: 'qa/l6-lens-dbg-pcfsoft.png' })
}
