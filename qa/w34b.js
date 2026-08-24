async page => {
  await page.waitForTimeout(1000);
  const out = {};
  out.samples = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(2000);
    out.samples.push(await page.evaluate(() => ({
      chaos: +window.__capy.state.chaos.toFixed(3),
      calm: +window.__capy.state.calm.toFixed(3),
      still: +window.__capy.capy.stillT.toFixed(1),
    })));
  }
  await page.evaluate((o) => fetch('/shot?name=w34b.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
