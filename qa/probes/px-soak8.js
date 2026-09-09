async page => {
  const out = [];
  for (const [k, n] of [['Digit3','quay'],['Digit4','kyoto'],['Digit5','cali'],
                        ['Minus','kowloon'],['Period','monaco'],['BracketRight','manly'],
                        ['Digit9','drift'],['Comma','antarctic']]) {
    await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(4300);
    await page.keyboard.press(k);
    await page.waitForTimeout(5500);
    await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(4000);
    await page.keyboard.down('KeyV'); await page.waitForTimeout(2000);
    await page.keyboard.up('KeyV');
    await page.keyboard.press('Space'); await page.waitForTimeout(1500);
    await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
    await page.waitForTimeout(1500);
    out.push(await page.evaluate(() => ({
      biome: window.__capy.biome.current,
      err: window.__capy.state.lastError || null,
      y: +window.__capy.capy.position.y.toFixed(2),
      clear: +window.__capy.camInfo.clear.toFixed(2),
    })));
  }
  await page.evaluate(o => fetch('/shot?name=px-soak8.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
