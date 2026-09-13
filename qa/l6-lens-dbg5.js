async page => {
  await page.evaluate(() => { const g = window.__capy; const s = []; g.scene.traverse(o => { if (o.isDirectionalLight) s.push(o) }); window.__suns = s; s.forEach(x => { if (x.castShadow && x.shadow.camera.left === -70) x.visible = false }) })
  await page.waitForTimeout(8000)
  await page.screenshot({ path: 'qa/l6-lens-dbg-farHidden.png' })
  const r = await page.evaluate(() => { const g = window.__capy; return window.__suns.map(s => ({ vis: s.visible, cast: s.castShadow, i: +s.intensity.toFixed(2), pos: s.position.toArray().map(v => +v.toFixed(1)), tgt: s.target.position.toArray().map(v => +v.toFixed(1)), tgtParent: !!s.target.parent, left: s.shadow ? s.shadow.camera.left : null, m: s.shadow ? s.shadow.matrix.elements.slice(12, 16).map(v => +v.toFixed(2)) : null })) })
  await page.evaluate(() => { window.__suns.forEach(x => { x.visible = true }) })
  await page.evaluate((o) => fetch("/shot?name=l6-lens-dbg5.json", { method: "POST", body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), r)
}
