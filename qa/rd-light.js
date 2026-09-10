async page => {
  // rd-light.js — the actual light rig, per chapter, read off the scene rather
  // than inferred from a screenshot. Sun colour as a colour temperature proxy
  // (r-b), the sun/hemi intensity ratio, and the warm-key-to-cool-fill gap that
  // the elevation term exists to open.
  const out = { rows: [] }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(2500)
  out.started = await page.evaluate(() => window.__capy.state.started)
  const list = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  for (const b of list) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(7000)
    out.rows.push(await page.evaluate(() => {
      const g = window.__capy
      let sun = null, hemi = null, amb = null
      g.scene.traverse((o) => {
        if (o.isDirectionalLight && o.castShadow) sun = o
        else if (o.isHemisphereLight) hemi = o
        else if (o.isAmbientLight) amb = o
      })
      const f = (c) => c ? [+c.r.toFixed(3), +c.g.toFixed(3), +c.b.toFixed(3)] : null
      const elev = sun ? +(Math.asin(Math.max(-1, Math.min(1,
        sun.position.clone().normalize().y))) * 180 / Math.PI).toFixed(1) : null
      const sc = sun && sun.color, hc = hemi && hemi.color
      return { cur: g.biome.current, elev,
               sun: f(sc), sunI: sun ? +sun.intensity.toFixed(3) : null,
               hemi: f(hc), hemiI: hemi ? +hemi.intensity.toFixed(3) : null,
               gnd: f(hemi && hemi.groundColor),
               ambI: amb ? +amb.intensity.toFixed(3) : null,
               // warm of the key minus warm of the fill: the separation the
               // whole term is for. Positive means warm sun over cool shade.
               gap: (sc && hc) ? +(((sc.r - sc.b) - (hc.r - hc.b))).toFixed(3) : null }
    }))
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rd-light.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
