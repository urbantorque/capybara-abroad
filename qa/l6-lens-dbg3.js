async page => {
  await page.evaluate(() => { const g = window.__capy; const s = []; g.scene.traverse(o => { if (o.isDirectionalLight && o.castShadow) s.push(o) }); window.__suns = s; s[1].castShadow = false })
  await page.waitForTimeout(6000)
  await page.screenshot({ path: 'qa/l6-lens-dbg-farNoCast.png' })
  const r = await page.evaluate(() => { const g = window.__capy; const p = g.renderer.info.programs; return { programs: p.length, err: g.state.lastError } })
  await page.evaluate(() => { window.__suns[1].castShadow = true })
  await page.waitForTimeout(6000)
  await page.screenshot({ path: 'qa/l6-lens-dbg-farCast.png' })
  await page.evaluate((o) => fetch("/shot?name=l6-lens-dbg3.json", { method: "POST", body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), r)
}
