async page => {
  await page.keyboard.press('Escape'); await page.waitForTimeout(800)
  const on = await page.evaluate(() => window.__capy.hud.photoAudit().on)
  if (!on) { await page.keyboard.press('KeyK') }
  await page.waitForTimeout(1600)
  const out = { on: await page.evaluate(() => window.__capy.hud.photoAudit().on),
                jr: await page.evaluate(() => document.querySelector('.capyui-jr').classList.contains('show')),
                biome: await page.evaluate(() => window.__capy.biome.current),
                rects: await page.evaluate(() => { const rr = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] }
                  return { phint: rr('.capyui-phint'), pcap: rr('.capyui-pcap'), bar: rr('.capyui-pbar.t') } }) }
  await page.evaluate(async (o) => { await fetch('/shot?name=b4ui-22.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
