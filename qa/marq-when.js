async page => {
  // ---------------------------------------------------------------------------
  // qa/marq-when.js — DOES THE SIGNPOST SAY WHEN? (ROADMAP-FUN, 1c)
  //
  // Five chapters' marquees ride a clock, and all five phase it to the arrival
  // already. What did not exist was any way for the player to read it: `nextIn`
  // is rendered on the clue under the TOP row, and a clocked marquee is never
  // the top row — it sits in act two or three. This reads the signpost's own
  // line in each of the five and checks the countdown is on it and falling.
  // ---------------------------------------------------------------------------
  const ORDER = ['venice', 'goreme', 'kowloon', 'palawan', 'hanoi']
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)

  const rows = []
  for (const b of ORDER) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(6000)
    const a = await page.evaluate(() => {
      const g = window.__capy
      return { biome: g.biome.current,
               say: (document.querySelector('.capyui-marqsay') || {}).textContent,
               on: !!(document.querySelector('.capyui-marq') || {}).classList &&
                   document.querySelector('.capyui-marq').classList.contains('on') }
    })
    // Ten seconds later the figure must have fallen by about ten.
    await page.evaluate(() => new Promise(r => setTimeout(r, 10000)))
    const b2 = await page.evaluate(() => ({
      say: (document.querySelector('.capyui-marqsay') || {}).textContent
    }))
    rows.push({ biome: a.biome, want: b, on: a.on, at6: a.say, at16: b2.say })
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=marq-when.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs })
}
