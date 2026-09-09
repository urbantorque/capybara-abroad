async page => {
  await page.reload();
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'qa/na-ui-title.png' });
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(7000);
  await page.screenshot({ path: 'qa/na-ui-play.png' });
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'qa/na-ui-journal.png' });
}
