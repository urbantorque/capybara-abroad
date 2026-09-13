async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(5000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  await page.keyboard.press('Escape'); await page.waitForTimeout(800)
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /settings/i.test(x.textContent)); if (b) b.click() })
  await page.waitForTimeout(600)
  const r = await page.evaluate(() => {
    const r = document.querySelector('input[aria-label="performance"]')
    r.value = '2'; r.dispatchEvent(new Event('input', { bubbles: true }))
    r.scrollIntoView({ block: 'center' })
    return { describedby: r.getAttribute('aria-describedby'), note: document.getElementById('capyui-perfnote').textContent }
  })
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'qa/l6-shot-settings.png' })
  await page.evaluate(async (o) => { await fetch('/shot?name=l6-shots2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, r)
}
