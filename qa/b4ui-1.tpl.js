async page => {
  const SCAN = /*SCAN*/
  const scan = () => page.evaluate(SCAN)
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  const SIZES = [[1280, 720], [1366, 768], [1600, 900], [1920, 1080], [900, 620], [390, 844]]
  const out = { title: [], setup: null }
  out.setup = await page.evaluate(() => ({
    started: !!(window.__capy && window.__capy.state && window.__capy.state.started),
    hud: document.querySelectorAll('[class^="capyui-"]').length,
    body: document.body.innerText.slice(0, 200)
  }))
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(900)
    const r = await scan()
    r.size = w + 'x' + h
    out.title.push(r)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=b4ui-1.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
