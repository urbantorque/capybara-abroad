async page => {
  // Fresh save, Begin, touch nothing for 12 s. What does the game say unprompted?
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  const begin = await page.$('text=Begin')
  if (begin) await begin.click(); else await page.mouse.click(430, 350)
  const seen = []
  const t0 = Date.now()
  while (Date.now() - t0 < 12000) {
    await page.waitForTimeout(250)
    const r = await page.evaluate(() => [...document.querySelectorAll('.capyui-toast')].map(e => e.textContent.replace(/\s+/g, ' ').trim()))
    for (const s of r) if (!seen.some(x => x.s === s)) seen.push({ t: (Date.now() - t0) / 1000, s })
  }
  const finds = await page.evaluate(() => { const g = window.__capy; return { done: g.hud.tasksDone(), pos: [g.capy.position.x, g.capy.position.z] } })
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=l4r-writing-idle.json', { method: 'POST', body: s })
  }, { seen, finds })
}
