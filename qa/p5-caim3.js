async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    g.biome.switchTo('pantanal')
    await sleep(1500)
    const b = g.capy.body
    const c0 = g.pantanal.caiman()
    const c = { x: c0.x, y: c0.y, z: c0.z }   // panV3b is SHARED scratch
    b.position.set(c.x, c.y + 0.66, c.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    await sleep(2600)
    const stayed = [+(b.position.y - c.y).toFixed(3),
                    +Math.hypot(b.position.x - c.x, b.position.z - c.z).toFixed(2)]
    const card = [...document.querySelectorAll('#hud *')].map(e=>e.textContent||'')
    const row = card.filter(t => t.indexOf('jacar') >= 0).slice(-1)[0] || ''
    return { caimanY: +c.y.toFixed(3), stayed, row: row.slice(0, 80) }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=p5caim3.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
