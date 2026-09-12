async page => {
  // L4 E1 (a1) — the key light's arithmetic, read live in four daylight chapters
  // and one night: the four intensities with the key on and with it cut
  // (game.state.noKey), sun·sinE against hemi + amb + fill, and the lit sum
  // that is supposed to be held. Plus post.params.dof for the defocus row.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const CH = [['Digit1', 'sydney'], ['Digit0', 'venice'], ['Equal', 'palawan'], ['Semicolon', 'pantanal'], ['Digit7', 'iceland']]
  const out = { rows: [] }
  for (const [key, name] of CH) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(9000)
    const row = await page.evaluate(async (name) => {
      const g = window.__capy
      const sun = g.scene.children.find(o => o.isDirectionalLight && o.castShadow)
      const hemi = g.scene.children.find(o => o.isHemisphereLight)
      const amb = g.scene.children.find(o => o.isAmbientLight)
      const fill = g.scene.children.find(o => o.isDirectionalLight && !o.castShadow)
      const read = () => {
        const sd = sun.position.clone().sub(sun.target.position).normalize()
        const sinE = sd.y
        const S = sun.intensity, H = hemi.intensity, A = amb.intensity, F = fill.intensity
        return { sun: +S.toFixed(2), hemi: +H.toFixed(2), amb: +A.toFixed(2), fill: +F.toFixed(2),
                 sunH: +(S * sinE).toFixed(2), dif: +(H + A + F).toFixed(2), ratio: +((S * sinE) / (H + A + F)).toFixed(2),
                 lit: +(S * sinE + H + A + F).toFixed(2), elev: +(Math.asin(sinE) * 180 / Math.PI).toFixed(0) }
      }
      const wait = (ms) => new Promise(r => setTimeout(r, ms))
      const on = read()
      g.state.noKey = true; await wait(400); const off = read(); g.state.noKey = false; await wait(400)
      const P = g.post.params
      return { name, biome: g.biome.current, on, off, dof: +P.dof.toFixed(2), far0: +P.dofFar0.toFixed(1), far1: +P.dofFar1.toFixed(1),
               timeScale: g.state.timeScale, err: g.state.lastError || null }
    }, name)
    out.rows.push(row)
  }
  await page.evaluate((o) => fetch('/shot?name=l4-key-rig.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
