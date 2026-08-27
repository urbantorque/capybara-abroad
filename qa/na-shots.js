async page => {
  const KEYS = [['Equal','palawan'],['Minus','kowloon'],['Period','monaco'],['Digit1','sydney'],['Digit0','venice'],['Digit6','rio']];
  for (let i = 0; i < KEYS.length; i++) {
    await page.reload();
    await page.waitForTimeout(4500);
    await page.keyboard.press(KEYS[i][0]);
    await page.waitForTimeout(7000);
    await page.evaluate((nm) => {
      const g = window.__capy;
      g.tick(1/60, true);
      const url = g.renderer.domElement.toDataURL('image/png');
      return fetch('/shot?name=na-' + nm, { method: 'POST', body: url });
    }, KEYS[i][1]);
  }
}
