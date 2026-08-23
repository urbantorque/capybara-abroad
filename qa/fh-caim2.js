async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    return { keys: Object.keys(localStorage), done: (g.state.done && Array.from(g.state.done)) || null,
             tasksDone: (g.tasksDone && Array.from(g.tasksDone)) || null,
             sample: localStorage.getItem(Object.keys(localStorage)[0] || '') }
  })
  await page.evaluate(async (o)=>{ await fetch('/shot?name=fhcaim2.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o).slice(0,1500))))}) }, out)
}
