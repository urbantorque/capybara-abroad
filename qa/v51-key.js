async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const a = await page.evaluate(() => {
    const g = window.__capy
    return { started: g.state.started, paused: g.state.paused, biome: g.biome.current,
             pos: { x: g.capy.position.x, z: g.capy.position.z } }
  })
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(1500)
  const b = await page.evaluate(() => {
    const g = window.__capy
    return { ix: g.input.x, iz: g.input.z, camYaw: g.input.camYaw,
             pos: { x: g.capy.position.x, z: g.capy.position.z } }
  })
  await page.keyboard.up('KeyW')
  const c = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const p0 = { x: window.__capy.capy.position.x, z: window.__capy.capy.position.z }
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }))
    await sleep(1500)
    const g = window.__capy
    const r = { ix: g.input.x, iz: g.input.z, moved: Math.hypot(g.capy.position.x - p0.x, g.capy.position.z - p0.z) }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }))
    return r
  })
  await page.evaluate(o => fetch('/shot?name=v51key.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), { a, b, c })
}
