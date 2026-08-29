async page => {
  const KEYS = ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9',
                'Digit0','Minus','Equal','BracketLeft','BracketRight','Semicolon','Quote',
                'Comma','Period','Slash'];
  const NAMES = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                 'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic',
                 'monaco','hanoi'];
  const PICK = [0,1,3,5,6,7,9,10,12,13,15,16,17,18];
  for (const i of PICK) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5200);
    await page.keyboard.press(KEYS[i]);
    await page.waitForTimeout(7000);
    const n2 = String(i + 1).padStart(2, '0');
    await page.screenshot({ path: 'qa/VR-' + n2 + '-' + NAMES[i] + '.png' });
  }
}
