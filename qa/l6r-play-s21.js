async page => {
  const b = await page.$('button.capyui-pausebtn >> text=RESUME')
  if (b) await b.click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'qa/l6r-play-44.png' })
}
