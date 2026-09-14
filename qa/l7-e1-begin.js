async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(9000)
  const out = { errs }
  out.rows = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const g = window.__capy; const rows = []
    const b = document.querySelector('.capyui-go'); if (b) b.click()
    const t0 = performance.now()
    while (performance.now() - t0 < 25000) {
      let m = null; try { m = g.musAudit() } catch (e) {}
      const B = (() => { try { return g.hud.audioBus().sfxOut.context.state } catch (e) { return '?' } })()
      rows.push([+((performance.now() - t0) / 1000).toFixed(1), g.state.started ? 1 : 0, B, m ? m.themeSaid : null, m ? +m.stingEnv.toFixed(2) : null, m ? m.pal : null, m ? m.busy : null, m ? m.liftTails : null])
      await sleep(200)
    }
    return rows
  })
  out.errsN = errs.length
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l7-e1-begin.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
