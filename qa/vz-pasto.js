async page => {
  await page.reload()
  await page.waitForTimeout(4800)
  await page.keyboard.press('Digit2')
  await page.waitForTimeout(8000)
  const samples = []
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(700)
    const r = await page.evaluate(() => {
      const g = window.__capy, b = g.capy && g.capy.body
      return { sp: b ? Math.round(Math.hypot(b.velocity.x, b.velocity.z) * 100) / 100 : null,
               vy: b ? Math.round(b.velocity.y * 100) / 100 : null,
               rest: Math.round(g.camInfo.rest * 100) / 100,
               pitch: Math.round(g.camInfo.pitch * 1800 / Math.PI) / 10,
               idle: Math.round(g.camInfo.idle * 100) / 100, hand: Math.round(g.camInfo.hand * 100) / 100,
               ix: g.input.x, iz: g.input.z, mounted: !!g.state.mounted }
    })
    samples.push(r)
  }
  await page.evaluate(o => fetch('/shot?name=vz-pasto.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), samples)
  await page.waitForTimeout(400)
}
