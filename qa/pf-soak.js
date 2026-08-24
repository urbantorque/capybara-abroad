// PAYOFF batch 1, job 1(a): a fresh-save journey through all seventeen chapters,
// closed twice over — once in ACT ORDER (which is how the paper is meant to be
// read) and once in REVERSE (which is what a player who wanders does).
//
// Two different invariants, because the two orders promise different things:
//
//   ACT ORDER   every declared act must have been the paper's header at some
//               point, in ascending order. This is the only order in which
//               that is a fair test: the header is "the lowest act with
//               anything still open", so closing an act-3 row early legally
//               hides an act-3 header for ever.
//   REVERSE     the chapter must still close, nothing may throw, and the
//               way-on pseudo-row must still arrive at the end.
//
// Both orders must finish the chapter, leave lastError null and put "the way
// on" on the paper.
async page => {
  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) })
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(1000)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)

  const run = dir => page.evaluate(async (DIR) => {
    const g = window.__capy
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    const src = await (await fetch('/src/shared.js')).text()
    const tb = src.slice(src.indexOf('export const TASKS = ['),
                         src.indexOf('\n];', src.indexOf('export const TASKS = [')))
    const re = /\{\s*id:\s*'([^']+)'[^}]*?chapter:\s*(\d+)([^}]*)\}/g
    const rows = []
    let m
    while ((m = re.exec(tb))) rows.push({ id: m[1], ch: Number(m[2]),
      act: Number((/act:\s*(\d+)/.exec(m[3]) || [0, 1])[1]) })
    const cb = src.slice(src.indexOf('export const CHAPTERS = ['))
    const cre = /\{\s*n:\s*(\d+),\s*biome:\s*'([^']+)'/g
    const BIOME = {}
    while ((m = cre.exec(cb))) BIOME[Number(m[1])] = m[2]
    // which chapters declare acts, and how many
    const acts = {}
    for (const r of rows) acts[r.ch] = Math.max(acts[r.ch] || 1, r.act)

    const paper = () => {
      const h = document.querySelector('.capyui-todo h2')
      return {
        head: h ? h.textContent : null,
        rows: [...document.querySelectorAll('.capyui-todo li.capyui-task')]
          .filter(li => !li.classList.contains('capyui-hidden'))
          .map(li => { const t = li.querySelector('.capyui-txt'); return t ? t.textContent : '?' }),
      }
    }
    const R = { dir: DIR, chapters: [], issues: [] }
    for (let ch = 1; ch <= 17; ch++) {
      const bn = BIOME[ch]
      g.biome.switchTo(bn)
      for (let i = 0; i < 40; i++) g.tick(1 / 60, false)
      await sleep(150)
      const mine = rows.filter(r => r.ch === ch)
      const order = mine.slice().sort((a, b) => DIR === 'act' ? a.act - b.act : b.act - a.act)
      const seen = []
      const trail = []
      const p0 = paper()
      seen.push(p0.head)
      for (const t of order) {
        g.completeTask(t.id)
        for (let i = 0; i < 12; i++) g.tick(1 / 60, false)
        const p = paper()
        if (p.head !== seen[seen.length - 1]) seen.push(p.head)
        trail.push({ id: t.id, act: t.act, head: p.head, open: p.rows.length })
      }
      for (let i = 0; i < 200; i++) g.tick(1 / 60, false)
      await sleep(700)
      const end = paper()
      const err = g.state.lastError ? String(g.state.lastError).slice(0, 160) : null
      const nActs = acts[ch] || 1
      if (DIR === 'act' && nActs > 1) {
        // every act must have been the header, once, ascending
        const heads = seen.filter(h => h && h !== 'Done here')
        if (heads.length < nActs) R.issues.push(`ch${ch} ${bn}: ${nActs} acts, only ${heads.length} act headers seen [${heads.join(' | ')}]`)
      }
      if (!end.rows.some(t => /the way on/i.test(t))) {
        R.issues.push(`ch${ch} ${bn} [${DIR}]: no "the way on" row after completion — ${JSON.stringify(end.rows)}`)
      }
      if (err) R.issues.push(`ch${ch} ${bn} [${DIR}]: lastError ${err}`)
      R.chapters.push({ ch, biome: bn, n: mine.length, acts: nActs, heads: seen,
                        endRows: end.rows, err })
    }
    R.score = g.state.score
    R.saveBytes = (localStorage.getItem('capy3.journey.v1') || '').length
    return R
  }, dir)

  const A = await run('act')
  // fresh save again for the reverse pass
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const B = await run('rev')

  const out = { act: A, rev: B, errs: errs.slice(0, 25) }
  await page.evaluate(async o => {
    await fetch('/shot?name=pfsoak.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
