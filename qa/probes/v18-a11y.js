async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(5500)
  await page.keyboard.press('Tab')
  await page.waitForTimeout(900)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const shelf = document.querySelector('.capyui-shelf')
    const slots = [...document.querySelectorAll('.capyui-slot')]
    const cap = document.querySelector('.capyui-shelfcap')
    const have = slots.find(s => s.classList.contains('have'))
    have.click()
    const res = {
      shelfRole: shelf.getAttribute('role'),
      slotRole: slots[0].getAttribute('role'),
      slotTag: slots[0].tagName,
      slotLabel: slots[0].getAttribute('aria-label'),
      capLive: cap.getAttribute('aria-live'),
      capAfterTap: cap.textContent,
      err: g.state.lastError || null,
    }
    await fetch('/shot?name=v18a11y.json', {
      method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(res, null, 1)))),
    })
    return 'ok'
  })
  await page.evaluate(() => { document.querySelector('.capyui-jrled').click() })
  await page.waitForTimeout(2500)
  await page.setViewportSize({ width: 390, height: 780 })
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'qa/shot-ledger-mobile.png' })
  await page.setViewportSize({ width: 1280, height: 860 })
  return out
}
