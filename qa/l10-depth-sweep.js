async page => {
  // CORRECTED 19-chapter depth-bin re-baseline. Same grid as vr-sweep.js but
  // WITHOUT the renderOrder/depthWrite exclusion that wrongly stripped a
  // chapter's own far atmospheric geometry (additive beams, mist planes) —
  // only the shared sky dome (renderOrder === -20 exactly) is excluded now.
  // Arrival frame only, no run/orbit — this is a re-measure, not a full
  // re-shoot.
  const KEYS = ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9',
                'Digit0','Minus','Equal','BracketLeft','BracketRight','Semicolon','Quote',
                'Comma','Period','Slash']
  const NAMES = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                 'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic',
                 'monaco','hanoi']
  const out = []
  await page.setViewportSize({ width: 1280, height: 760 })
  for (let i = 0; i < 19; i++) {
    const n2 = String(i + 1).padStart(2, '0')
    try {
      await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
      await page.reload()
      await page.waitForTimeout(5200)
      await page.keyboard.press(KEYS[i])
      await page.waitForTimeout(8500)
      const row = await page.evaluate(() => {
        const g = window.__capy, T = g.THREE
        const cam = g.camera
        const vis = o => { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true }
        const rc = new T.Raycaster(); rc.far = 5000
        const bins = { near: 0, mid: 0, far: 0, sky: 0 }
        let n = 0
        for (let yy = 0; yy < 9; yy++) for (let xx = 0; xx < 13; xx++) {
          rc.setFromCamera(new T.Vector2(-1 + (xx + 0.5) * 2 / 13, 1 - (yy + 0.5) * 2 / 9), cam)
          const hits = rc.intersectObjects(g.scene.children, true).filter(h => vis(h.object) && h.object.renderOrder !== -20)
          n++
          if (!hits.length) { bins.sky++; continue }
          const d = hits[0].distance
          if (d < 20) bins.near++; else if (d < 60) bins.mid++; else if (d < 400) bins.far++; else bins.sky++
        }
        for (const k in bins) bins[k] = +(bins[k] / n).toFixed(3)
        return { biome: g.biome.current, bins }
      })
      row.want = NAMES[i]
      out.push(row)
    } catch (e) {
      out.push({ want: NAMES[i], fail: String(e.message || e) })
    }
  }
  await page.evaluate(o => fetch('/shot?name=l10-depth-sweep.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
