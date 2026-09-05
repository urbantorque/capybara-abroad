async page => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5188/');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6500);
  // play Sydney for a bit so there is a file to carry on from
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);
  // A save is written on a completed task, not on walking about: the first
  // version of this probe waddled for three seconds and read a 0-byte file.
  await page.evaluate(() => window.__capy.completeTask('wheek'));
  await page.waitForTimeout(2500);
  await page.waitForTimeout(1500);
  const saved = await page.evaluate(() => {
    try { return (localStorage.getItem('capy3.journey.v1') || '').length; } catch (e) { return -1; }
  });
  // NO addInitScript here: this run has to keep the save it just wrote.
  await page.reload();
  await page.waitForTimeout(6500);
  const pre = await page.evaluate(() => ({
    pitch: +(window.__capy.camInfo.pitch * 180 / Math.PI).toFixed(1),
    reach: +window.__capy.camInfo.reach.toFixed(2),
    carry: !!document.querySelector('.capyui-carry'),
  }));
  await page.screenshot({ path: 'qa/TR-carry-title.png' });
  // "Carry on" is the first control on the card when there is a file
  const carry = page.locator('.capyui-carry');
  const n = await carry.count();
  if (n) await carry.click();
  const trail = [];
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(200);
    trail.push(await page.evaluate(() => ({
      t: 0, pitch: +(window.__capy.camInfo.pitch * 180 / Math.PI).toFixed(1),
      reach: +window.__capy.camInfo.reach.toFixed(2),
    })));
    if (i === 1) await page.screenshot({ path: 'qa/TR-restore-0.4s.png' });
    if (i === 8) await page.screenshot({ path: 'qa/TR-restore-1.8s.png' });
  }
  await page.evaluate(o => fetch('/shot?name=tr.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), { savedBytes: saved, pre, hadCarry: n, trail });
}
