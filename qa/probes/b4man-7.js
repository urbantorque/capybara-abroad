async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch(e){} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(async () => {
    function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
    const g = window.__capy
    g.biome.switchTo('manly'); await sleep(1200)
    const m = g.manly, capy = g.capy, b = capy.body
    let fired = false
    const rt = g.toast
    g.toast = function (t) { if (/all the way/.test(t)) fired = true; return rt.apply(g, arguments) }
    const bankZ = m.bank().z
    for (let run = 0; run < 10 && !fired; run++) {
      b.position.set(0, 0.6, bankZ - 6); b.velocity.set(0, 0, 0)
      for (let i = 0; i < 2400 && !fired; i++) { g.tick(1/60, false); if (capy.position.z > 26) break }
      await sleep(0)
    }
    window.__fired = fired
  })
  await page.waitForTimeout(250)
}
