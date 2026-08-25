async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('cave')
    const A = g.cave, b = g.capy.body
    const ty = A.terrainHeight(0, -86)
    b.position.set(0, ty + 0.6, -86); b.velocity.set(0,0,0)
    for (let i = 0; i < 200; i++) g.tick(1/60, false)
  })
  await page.waitForTimeout(1200)
  await page.keyboard.press('k'); await page.waitForTimeout(1400)
  await page.keyboard.press('Enter'); await page.waitForTimeout(1800)
  const out = await page.evaluate(() => {
    let raw = null
    try { raw = localStorage.getItem('capy3.album.v1') } catch (e) {}
    const keys = []
    try { for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i)) } catch (e) {}
    return { keys, len: raw ? raw.length : 0, head: raw ? raw.slice(0, 220) : null }
  })
  await page.evaluate(async o => { await fetch('/shot?name=b4-cavalb.json',{method:'POST',body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
