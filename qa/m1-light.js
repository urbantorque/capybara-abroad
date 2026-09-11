async page => {
  const out = { rows: [] }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.evaluate(() => {
    const all = Array.prototype.slice.call(document.querySelectorAll('.capyui-go'))
    const b = all.filter(function (e) { return !e.classList.contains('alt') })[0] || all[0]
    if (b) b.click()
  })
  await page.waitForTimeout(2500)
  out.started = await page.evaluate(() => window.__capy.state.started)
  for (const b of ['manly', 'quay', 'pantanal', 'sahara', 'antarctic', 'rio']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(9000)
    out.rows.push(await page.evaluate(() => {
      const g = window.__capy
      let hemi = null, dir = null, amb = null
      g.scene.traverse(function (o) {
        if (o.isHemisphereLight) hemi = o
        else if (o.isDirectionalLight && !dir) dir = o
        else if (o.isAmbientLight) amb = o
      })
      const px = function (c, i) { return c ? [+(c.r * i).toFixed(3), +(c.g * i).toFixed(3), +(c.b * i).toFixed(3)] : null }
      const bg = g.scene.background && g.scene.background.isColor ? g.scene.background : null
      return { cur: g.biome.current,
               hemiSky: hemi ? px(hemi.color, hemi.intensity) : null,
               hemiGnd: hemi ? px(hemi.groundColor, hemi.intensity) : null,
               sun: dir ? px(dir.color, dir.intensity) : null,
               sunY: dir ? +(dir.position.clone().sub(dir.target.position).normalize().y).toFixed(3) : null,
               amb: amb ? px(amb.color, amb.intensity) : null,
               bg: bg ? [+bg.r.toFixed(3), +bg.g.toFixed(3), +bg.b.toFixed(3)] : null,
               toneExp: g.renderer.toneMappingExposure, tone: g.renderer.toneMapping }
    }))
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=m1-light.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
