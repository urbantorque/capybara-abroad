async page => {
  const out = await page.evaluate(() => {
    const els = [...document.querySelectorAll('body *')].filter(e => /^\d+(\.\d+)? m$|^here$/.test(e.textContent.trim()))
    return els.map(e => ({ cls: e.className, txt: e.textContent.trim(), parent: e.parentElement.className, phtml: e.parentElement.outerHTML.slice(0, 400) }))
  })
  await page.evaluate((o) => fetch('/shot?name=l6r-play-s16.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
