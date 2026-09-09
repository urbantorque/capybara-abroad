async page => {
  await page.evaluate(() => { try { localStorage.removeItem('capy3.journey.v1') } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(4000)
  const out = await page.evaluate(async () => {
    const src = await (await fetch('/src/shared.js')).text()
    const b = src.slice(src.indexOf('export const TASKS = ['),
                        src.indexOf('\n];', src.indexOf('export const TASKS = [')))
    const re = /\{\s*id:\s*'([^']+)'[\s\S]*?chapter:\s*(\d+)(?:,\s*act:\s*(\d+))?/g
    const rows = []
    let m
    while ((m = re.exec(b))) rows.push({ id: m[1], ch: Number(m[2]), act: Number(m[3] || 1) })
    const csrc = src.slice(src.indexOf('export const CHAPTERS = ['))
    const g = window.__capy
    const snap = () => ({
      head: document.querySelector('.capyui-todo h2').textContent,
      rows: [...document.querySelectorAll('.capyui-todo li.capyui-task')]
        .filter(li => !li.classList.contains('capyui-hidden'))
        .map(li => li.querySelector('.capyui-txt').textContent),
    })
    const BIOME = { 3: 'quay', 7: 'iceland', 8: 'sahara', 10: 'venice', 16: 'cave', 17: 'antarctic' }
    const report = {}
    for (const ch of [3, 8, 10, 16, 17]) {
      g.biome.switchTo(BIOME[ch])
      for (let i = 0; i < 20; i++) g.tick(1 / 60, false)
      const mine = rows.filter(r => r.ch === ch)
      const maxAct = Math.max(...mine.map(r => r.act))
      const steps = [snap()]
      for (let a = 1; a <= maxAct; a++) {
        mine.filter(r => r.act === a).forEach(r => g.completeTask(r.id))
        for (let i = 0; i < 20; i++) g.tick(1 / 60, false)
        steps.push(snap())
      }
      report[ch] = { acts: maxAct, steps: steps }
    }
    report.err = g.state.lastError || null
    await fetch('/shot?name=v18acts.json', {
      method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(report, null, 1)))),
    })
    return 'ok'
  })
  return out
}
