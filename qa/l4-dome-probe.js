async page => {
  // L4 E1 (a1) — did the sky dome's exemption shader compile, and does it bite?
  // Sahara (shared dome) and Sydney (its own): the dome program's diagnostics,
  // and the mean colour of the top 12% of the frame with the dome's ratios live
  // against forced to (1,1,1).
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  const out = { rows: [] }
  for (const [key, name] of [['Digit8', 'sahara'], ['Digit1', 'sydney']]) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(9000)
    const row = await page.evaluate(async (name) => {
      const g = window.__capy, r = g.renderer
      const c = g.canvas || r.domElement
      const domes = []
      g.scene.traverse(o => { if (o.isMesh && o.material && o.material.customProgramCacheKey && o.material.customProgramCacheKey() === 'skydome') domes.push(o) })
      const info = domes.map(d => { const p = r.properties.get(d.material); const pr = p && p.currentProgram; return { visible: d.visible, parentVisible: d.parent ? d.parent.visible : null, hasProgram: !!pr, diag: pr && pr.diagnostics ? String(pr.diagnostics.fragmentShader && pr.diagnostics.fragmentShader.log || pr.diagnostics.programLog).slice(0, 300) : null, uni: d.material.uniforms ? 'has' : 'none' } })
      const grab = () => { g.post.render(); return c.toDataURL('image/png') }
      const cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height
      const cx = cv.getContext('2d', { willReadFrequently: true })
      async function topMean(url) { const im = new Image(); await new Promise(res => { im.onload = res; im.src = url }); cx.drawImage(im, 0, 0); const d = cx.getImageData(0, 0, cv.width, Math.floor(cv.height * 0.12)).data; let R = 0, G = 0, B = 0, n = 0; for (let i = 0; i < d.length; i += 16) { R += d[i]; G += d[i + 1]; B += d[i + 2]; n++ } return [R / n, G / n, B / n].map(v => +v.toFixed(0)) }
      const live = await topMean(grab())
      const ka = g.hud.keyAudit()
      // force the ratios to 1 by hand through the shared uniform: find it on a compiled program's uniforms
      const p = domes[0] && r.properties.get(domes[0].material)
      let forced = null
      if (p && p.currentProgram) {
        const u = p.currentProgram.getUniforms().map.uKeyDome
        forced = u ? 'uniform bound' : 'uKeyDome NOT in program'
      }
      return { name, biome: g.biome.current, domes: info, top: live, key: ka, forced, err: g.state.lastError || null }
    }, name)
    out.rows.push(row)
  }
  await page.evaluate((o) => fetch('/shot?name=l4-dome-probe.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
