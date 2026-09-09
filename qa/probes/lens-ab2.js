async page => {
  const KEYS = { sydney: 'Digit1', iceland: 'Digit7', kowloon: 'Equal', monaco: 'Period', venice: 'Minus' };
  for (const name in KEYS) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5200);
    await page.keyboard.press(KEYS[name]);
    await page.waitForTimeout(7000);
    await page.screenshot({ path: 'qa/LN-' + name + '-on.png' });
    await page.evaluate(() => { const s = window.__capy.state;
      s.noWide = true; s.noSplit = true; s.noShoulder = true; s.noVigTone = true; });
    await page.waitForTimeout(700);
    await page.screenshot({ path: 'qa/LN-' + name + '-off.png' });
  }
}
