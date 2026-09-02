async page => {
  // How much of the resting frame is cast shadow? Paired A/B inside one JS
  // turn: render, read pixels, switch the sun's shadow off, render, read,
  // restore. Reports the fraction of the frame that changed and the mean luma
  // lift where it did. Four chapters, each entered through the picker key.
  await page.setViewportSize({ width: 1280, height: 760 })
  const out = { rows: [] }
  const KEYS = ['Digit1', 'Digit4', 'Digit0', 'Digit8']
  for (const key of KEYS) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(12000)
    const row = await page.evaluate(() => {
      const g = window.__capy
      const r = g.renderer
      const c = r.domElement
      let sun = null
      g.scene.traverse(o => { if (!sun && o.isDirectionalLight && o.castShadow) sun = o })
      const grab = () => {
        g.tick(1 / 60, true)
        const cv = document.createElement('canvas')
        cv.width = c.width; cv.height = c.height
        const ctx = cv.getContext('2d')
        ctx.drawImage(c, 0, 0)
        return ctx.getImageData(0, 0, cv.width, cv.height).data
      }
      const A = grab()
      sun.castShadow = false
      r.shadowMap.needsUpdate = true
      g.tick(1 / 60, true)
      const B = grab()
      sun.castShadow = true
      r.shadowMap.needsUpdate = true
      g.tick(1 / 60, true)
      const n = A.length / 4
      let changed = 0, sumLift = 0, sumA = 0, sumB = 0
      const hist = new Array(16).fill(0)
      for (let i = 0; i < n; i++) {
        const la = 0.299 * A[i * 4] + 0.587 * A[i * 4 + 1] + 0.114 * A[i * 4 + 2]
        const lb = 0.299 * B[i * 4] + 0.587 * B[i * 4 + 1] + 0.114 * B[i * 4 + 2]
        sumA += la; sumB += lb
        const d = lb - la
        if (d > 6) { changed++; sumLift += d; hist[Math.min(15, Math.floor(d / 8))]++ }
      }
      return { biome: g.biome.current, w: c.width, h: c.height,
               shadowFrac: Math.round(1000 * changed / n) / 1000,
               meanLiftInShadow: changed ? Math.round(10 * sumLift / changed) / 10 : 0,
               frameMeanA: Math.round(sumA / n), frameMeanB: Math.round(sumB / n),
               hist: hist, radius: sun.shadow.radius, mapSize: sun.shadow.mapSize.x,
               sunDir: sun.position.clone().sub(sun.target.position).normalize().toArray().map(v => Math.round(v * 100) / 100),
               sunIntensity: sun.intensity }
    })
    out.rows.push(Object.assign({ key: key }, row))
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=rv-shadow.json', { method: 'POST', body: s })
  }, out)
}
