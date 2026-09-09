async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('kowloon')
    const b = g.capy.body
    b.position.set(0, 1.4, -52); b.velocity.set(0,0,0)
    const rows = []
    for (let s = 0; s < 20; s++) {
      for (let i = 0; i < 300; i++) { g.tick(1/60, false); b.position.set(0,1.4,-52); b.velocity.set(0,0,0) }
      rows.push({ s: (s+1)*5, phase: +g.kowloon.debugPhase ? g.kowloon.debugPhase() : null,
                  lit: g.kowloon.debugLit ? g.kowloon.debugLit() : null })
    }
    const em = []
    for (const o of g.scene.children) {}
    let towers = 0, emiss = 0
    g.scene.traverse(o => { if (o.isMesh && o.material && o.material.emissiveIntensity > 0.01) emiss++ })
    return { rows, emiss, keys: Object.keys(g.kowloon || {}), t: g.state.time }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=s3probe.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
