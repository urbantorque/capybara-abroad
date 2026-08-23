async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const r = { hasSay: typeof g.say === 'function', started: g.state.started }
    g.biome.switchTo('manly')
    await new Promise(x=>setTimeout(x,900))
    const p = g.capy.position
    g.say(p.x, p.y + 1.0, p.z + 3, 'PROBE LINE ONE TWO THREE')
    await new Promise(x=>setTimeout(x,500))
    const hud = document.getElementById('hud')
    r.found = hud ? hud.innerText.indexOf('PROBE LINE') >= 0 : false
    r.html = hud ? hud.innerHTML.indexOf('PROBE LINE') >= 0 : false
    r.hudDivs = hud ? hud.querySelectorAll('div').length : -1
    return r
  })
  await page.evaluate(async (o)=>{ await fetch('/shot?name=fesay.json',{method:'POST',body:btoa(JSON.stringify(o))}) }, out)
}
