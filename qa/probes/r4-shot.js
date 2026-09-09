async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 4500)));
  await page.keyboard.press('Digit1');
  await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));
  await page.keyboard.press('Escape');
  await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.capyui-pausebtn'))
      .filter(x => /settings/i.test(x.textContent))[0];
    if (b) b.click();
  });
  await page.evaluate(() => new Promise(r => setTimeout(r, 900)));
}
