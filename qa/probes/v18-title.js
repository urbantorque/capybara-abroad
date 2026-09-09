async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'qa/shot-title-keeps.png' })
  const out = await page.evaluate(async () => {
    const keeps = [...document.querySelectorAll('.capyui-pickkeep')].map(k => k.title)
    const res = { badges: keeps.length, titles: keeps }
    await fetch('/shot?name=v18title.json', {
      method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(res, null, 1)))),
    })
    return 'ok'
  })
  return out
}
