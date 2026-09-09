async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const a = await page.evaluate(() => {
    const g = window.__capy
    const p = g.props[0]
    return { n: g.props.length, keys: p ? Object.keys(p) : null,
             hasMesh: !!(p && p.mesh), parent: p && p.mesh && p.mesh.parent ? p.mesh.parent.name || p.mesh.parent.type : null,
             vis: p && p.mesh ? p.mesh.visible : null }
  })
  const b = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const g = window.__capy
    g.biome.switchTo('kyoto')
    await sleep(2500)
    const stat = { n: g.props.length, withMesh: 0, parented: 0, visible: 0, awake: 0, byType: {} }
    for (const p of g.props) {
      if (p && p.mesh) stat.withMesh++
      if (p && p.mesh && p.mesh.parent) stat.parented++
      if (p && p.mesh && p.mesh.visible) stat.visible++
      if (p && p.body && p.body.sleepState !== 2) stat.awake++
      if (p) stat.byType[p.type] = (stat.byType[p.type] || 0) + 1
    }
    const p = g.props[g.props.length - 1]
    stat.lastKeys = p ? Object.keys(p) : null
    stat.lastParent = p && p.mesh && p.mesh.parent ? (p.mesh.parent.name || p.mesh.parent.type) : null
    stat.lastPos = p && p.body ? { x: Math.round(p.body.position.x), z: Math.round(p.body.position.z) } : null
    return stat
  })
  await page.evaluate(o => fetch('/shot?name=v51diag.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), { sydney: a, kyoto: b })
}
