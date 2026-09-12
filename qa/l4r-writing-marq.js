async page => {
  // Is the marquee signpost on the paper at all? Fresh save, Begin, then Kyoto.
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  const begin = await page.$('text=Begin')
  if (begin) await begin.click(); else await page.mouse.click(430, 350)
  await page.waitForTimeout(6000)
  const probe = () => page.evaluate(() => {
    const m = document.querySelector('.capyui-marq')
    const cs = m ? getComputedStyle(m) : null
    const g = window.__capy
    return {
      cls: m ? m.className : null, display: cs ? cs.display : null,
      text: m ? m.textContent.replace(/\s+/g, ' ').trim() : null,
      rect: m ? m.getBoundingClientRect().toJSON() : null,
      biome: g.biome.current,
      paper: (document.querySelector('.capyui-todo') || {}).innerText
    }
  })
  const out = { sydney: await probe() }
  await page.evaluate(() => { window.__capy.hud.cross('kyoto') })
  await page.waitForTimeout(8000)
  out.kyoto = await probe()
  await page.screenshot({ path: 'qa/l4r-writing-kyoto-marq.png' })
  // wait 45 s standing still — does the riddle timer bring anything up?
  await page.waitForTimeout(45000)
  out.kyoto45 = await probe()
  await page.screenshot({ path: 'qa/l4r-writing-kyoto-45s.png' })
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=l4r-writing-marq.json', { method: 'POST', body: s })
  }, out)
}
