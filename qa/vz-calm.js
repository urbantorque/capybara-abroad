async page => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.keyboard.press('Digit0')
  await page.waitForTimeout(9000)
  await page.evaluate(() => {
    window.__s = []
    window.__iv = setInterval(function () {
      const g = window.__capy
      window.__s.push({ x: g.camera.position.x, y: g.camera.position.y, z: g.camera.position.z,
                        rest: Math.round(g.camInfo.rest * 100) / 100,
                        p: Math.round(g.camInfo.pitch * 1800 / Math.PI) / 10 })
    }, 50)
  })
  await page.waitForTimeout(3000)
  const out = await page.evaluate(() => {
    clearInterval(window.__iv)
    const s = window.__s
    let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9
    for (const r of s) {
      if (r.x < mnx) mnx = r.x
      if (r.x > mxx) mxx = r.x
      if (r.y < mny) mny = r.y
      if (r.y > mxy) mxy = r.y
    }
    return { calm: matchMedia('(prefers-reduced-motion: reduce)').matches,
             rest: s[s.length - 1].rest, pitch: s[s.length - 1].p,
             driftX: Math.round((mxx - mnx) * 10000) / 10000,
             driftY: Math.round((mxy - mny) * 10000) / 10000 }
  })
  await page.evaluate(o => fetch('/shot?name=vz-calm.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
  await page.waitForTimeout(300)
}
