async page => {
  await page.reload()
  await page.waitForTimeout(5600)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(2600)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('goreme')
    const sp = g.biome.spawnOf('goreme')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2600))
    const G = g.goreme
    const onPad = G.fieldDebug()
    G.setPhase(0.288)
    const rows = []
    for (let k = 0; k < 8; k++) {
      await new Promise(r => setTimeout(r, 2500))
      const d = G.fieldDebug()
      rows.push({ y: d.launchY, parts: d.launchParts, envY: d.launchEnvY,
                  rigY: d.launchRigY, x: d.launchX, body: d.launchBody })
    }
    return { onPad: { parts: onPad.launchParts, envY: onPad.launchEnvY, rigY: onPad.launchRigY },
             rows, err: g.state.lastError || null }
  })
  await page.evaluate(o => fetch('/shot?name=T5-bal2.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
