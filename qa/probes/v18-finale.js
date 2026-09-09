async page => {
  await page.evaluate(() => { try { localStorage.removeItem('capy3.journey.v1') } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(4000)
  await page.evaluate(async () => {
    const src = await (await fetch('/src/shared.js')).text()
    const b = src.slice(src.indexOf('export const TASKS = ['),
                        src.indexOf('\n];', src.indexOf('export const TASKS = [')))
    const re = /\{\s*id:\s*'([^']+)'/g
    const g = window.__capy
    const ids = []
    let m
    while ((m = re.exec(b))) ids.push(m[1])
    for (let i = 0; i < ids.length - 1; i++) g.completeTask(ids[i], true)
    g.completeTask(ids[ids.length - 1])
  })
  await page.waitForTimeout(9000)
  await page.screenshot({ path: 'qa/shot-finale.png' })
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const led = document.querySelector('.capyui-led')
    const res = {
      shown: led.classList.contains('show'),
      title: led.querySelector('h2').textContent,
      sub: led.querySelector('.capyui-ledsub').textContent,
      foot: led.querySelector('.capyui-ledfoot').textContent,
      hint: led.querySelector('.capyui-ledhint').textContent,
      rows: led.querySelectorAll('.capyui-ledrow').length,
      keeps: led.querySelectorAll('.capyui-ledkeep').length,
      paused: g.state.paused,
      err: g.state.lastError || null,
    }
    await fetch('/shot?name=v18fin.json', {
      method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(res, null, 1)))),
    })
    return 'ok'
  })
  return out
}
