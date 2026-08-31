async page => {
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5500)
  const out = {}

  await page.mouse.click(20, 20)
  await page.waitForTimeout(300)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(3500)

  await page.keyboard.press('KeyQ')
  await page.waitForTimeout(1200)

  await page.keyboard.down('ShiftLeft')
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(2200)
  await page.keyboard.down('ControlLeft')
  await page.waitForTimeout(1400)
  await page.keyboard.up('ControlLeft')
  await page.keyboard.up('KeyW')
  await page.keyboard.up('ShiftLeft')
  await page.waitForTimeout(2200)

  out.before = await page.evaluate(() => {
    const o = JSON.parse(localStorage.getItem('capy3.journey.v1') || '{}')
    return { slid: o.slid, tasks: (o.tasks || []).length }
  })

  await page.reload()
  await page.waitForTimeout(5500)
  out.carryOn = await page.evaluate(() => {
    const b = document.querySelector('.capyui-go')
    return b ? b.textContent : null
  })
  await page.mouse.click(20, 20)
  await page.waitForTimeout(300)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(3500)
  await page.evaluate(() => {
    window.__toasts = []
    new MutationObserver(ms => {
      for (const m of ms) for (const n of m.addedNodes) {
        if (n.textContent) window.__toasts.push(n.textContent)
      }
    }).observe(document.querySelector('.capyui-toasts'), { childList: true })
  })
  out.restoredTasks = await page.evaluate(() => !!window.__capy.taskDone('wheek'))
  await page.keyboard.down('ShiftLeft')
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(3200)
  await page.keyboard.up('KeyW')
  await page.keyboard.up('ShiftLeft')
  await page.waitForTimeout(900)
  out.afterReload = await page.evaluate(() => window.__toasts.slice())
  out.lastError = await page.evaluate(() => window.__capy.state.lastError || null)

  await page.evaluate(async (o) => {
    await fetch('/shot?name=r1-slide2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
