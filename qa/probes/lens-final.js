async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: 'qa/LF-title.png' });
  await page.keyboard.press('BracketLeft');
  await page.waitForTimeout(9000);
  await page.screenshot({ path: 'qa/LF-goreme.png' });
}
