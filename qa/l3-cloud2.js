async page => {
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)
  const r = await page.evaluate(async () => {
    const g = window.__capy
    g.cloudForce(0.9)
    await new Promise(r => setTimeout(r, 400))
    const gl = g.renderer.getContext()
    const out = []
    for (const p of g.renderer.info.programs) {
      const src = gl.getShaderSource(p.fragmentShader) || ''
      if (!/uCloudK/.test(src)) continue
      const loc = gl.getUniformLocation(p.program, 'uCloudK')
      const locT = gl.getUniformLocation(p.program, 'uGrainT')
      out.push({ id: p.id, used: p.usedTimes, loc: !!loc, val: loc ? gl.getUniform(p.program, loc) : null, t: locT ? gl.getUniform(p.program, locT) : null })
    }
    return out
  })
  await page.evaluate((o) => fetch('/shot?name=l3-cloud2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), r)
}
