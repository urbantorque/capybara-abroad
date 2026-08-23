async page => {
  await page.reload()
  await page.waitForTimeout(4500)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
  await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('kowloon')
    await new Promise(r => setTimeout(r, 900))
    g.renderer.setSize(1280, 760, false)
    g.camera.aspect = 1280 / 760
    g.camera.updateProjectionMatrix()
  })
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW')
  await page.waitForTimeout(1600)
  const shot = await page.evaluate(async () => {
    const g = window.__capy
    await new Promise(r => requestAnimationFrame(r))
    const fov = g.camera.fov
    const data = g.canvas.toDataURL('image/png').split(',')[1]
    await fetch('/shot?name=gp-running', { method: 'POST', body: data })
    return { fov: +fov.toFixed(2), sp: +Math.hypot(g.capy.velocity.x, g.capy.velocity.z).toFixed(2) }
  })
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft')
  await page.evaluate(async (s) => {
    await fetch('/shot?name=gp-shot.json', { method: 'POST', body: btoa(JSON.stringify(s)) })
  }, shot)
}
