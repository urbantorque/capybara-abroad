async page => {
  await page.evaluate(() => { const g = window.__capy; const s = []; g.scene.traverse(o => { if (o.isDirectionalLight && o.castShadow) s.push(o) }); s[1].shadow.intensity = 0; window.__suns = s })
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'qa/l6-lens-dbg-farI0.png' })
  await page.evaluate(() => { window.__suns[1].shadow.intensity = 1; window.__suns[0].shadow.intensity = 0 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'qa/l6-lens-dbg-nearI0.png' })
  await page.evaluate(() => { window.__suns[0].shadow.intensity = 1 })
}
