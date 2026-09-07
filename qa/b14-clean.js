async page => {
  // A real session with the feature live: arrive, open both cards, read the
  // console. B14 adds a projection that runs on every card refresh and a
  // fourth element to a card the whole game shares.
  const errs = [], warns = []
  page.on('pageerror', e => errs.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text())
                            else if (m.type() === 'warning') warns.push(m.text()) })
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)
  const steps = []
  for (const [n, s, c, b] of [[0, 0, 1, 'kyoto'], [40, 10, 6, 'goreme'],
                              [120, 40, 19, 'antarctic']]) {
    await page.evaluate((v) => { window.__capy.hud.forceNoto(v[0], v[1], v[2]) }, [n, s, c])
    await page.evaluate((bi) => { window.__capy.hud.cross(bi) }, b)
    await page.waitForTimeout(11000)
    steps.push(await page.evaluate(() => {
      const g = window.__capy
      return { noto: g.hud.notoAudit().name, biome: g.biome.current,
               fps: g.state.fps ? +g.state.fps.toFixed(1) : null }
    }))
    await page.evaluate(async () => {
      const byText = t => [].find.call(document.querySelectorAll('button'),
                                       b => (b.textContent || '').trim() === t)
      const press = el => { if (!el) return
        el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el.click() }
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }))
      await new Promise(r => setTimeout(r, 600))
      press(byText('the journey so far'))
      await new Promise(r => setTimeout(r, 800))
      press(byText('the journey, laid out'))
      await new Promise(r => setTimeout(r, 900))
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }))
      await new Promise(r => setTimeout(r, 500))
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }))
      await new Promise(r => setTimeout(r, 500))
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }))
    })
    await page.waitForTimeout(2000)
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=b14-clean.json', { method: 'POST', body: s })
  }, { steps: steps, errs: errs.slice(0, 8), errN: errs.length,
       warns: warns.slice(0, 8), warnN: warns.length })
}
